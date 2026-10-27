import { Router } from 'express';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { pool } from '../db.js';

const router = Router();
const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;
const PASSWORD_MIN = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const attempts = new Map();

function unavailable(res) {
  if (!process.env.DATABASE_URL) {
    res.status(503).json({ error: 'Autenticação ainda não configurada: falta DATABASE_URL no servidor.' });
    return true;
  }
  return false;
}
function hashToken(token) { return createHash('sha256').update(token).digest('hex'); }
function cleanUser(row) { return { id: row.id, email: row.email, name: row.name || row.email.split('@')[0] }; }
function checkRateLimit(req, res, next) {
  const now = Date.now();
  const key = `${req.ip}:${String(req.body?.email || '').toLowerCase().slice(0, 150)}`;
  const old = attempts.get(key) || { count: 0, reset: now + 15 * 60 * 1000 };
  if (now > old.reset) { old.count = 0; old.reset = now + 15 * 60 * 1000; }
  old.count += 1;
  attempts.set(key, old);
  if (old.count > 12) return res.status(429).json({ error: 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.' });
  next();
}
async function passwordHash(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${salt.toString('hex')}$${Buffer.from(derived).toString('hex')}`;
}
async function verifyPassword(password, encoded) {
  const [algorithm, saltHex, hashHex] = String(encoded || '').split('$');
  if (algorithm !== 'scrypt' || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = Buffer.from(await scrypt(password, Buffer.from(saltHex, 'hex'), expected.length, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function createSession(client, userId) {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  await client.query('INSERT INTO vortex_sessions (user_id, token_hash, expires_at) VALUES ($1, $2, NOW() + ($3 * INTERVAL \'1 day\'))', [userId, tokenHash, SESSION_DAYS]);
  return token;
}
async function sessionUser(req) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token.length > 200) return null;
  const result = await pool.query(
    `SELECT u.id, u.email, p.name
       FROM vortex_sessions s
       JOIN vortex_users u ON u.id = s.user_id
       LEFT JOIN LATERAL (SELECT name FROM vortex_profiles WHERE user_id = u.id ORDER BY created_at LIMIT 1) p ON TRUE
      WHERE s.token_hash = $1 AND s.expires_at > NOW()`, [hashToken(token)]
  );
  if (!result.rows[0]) return null;
  await pool.query('UPDATE vortex_sessions SET last_seen_at = NOW() WHERE token_hash = $1', [hashToken(token)]);
  return { user: cleanUser(result.rows[0]), token };
}

router.post('/register', checkRateLimit, async (req, res) => {
  if (unavailable(res)) return;
  const name = String(req.body?.name || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (name.length < 2 || name.length > 40) return res.status(400).json({ error: 'Informe um nome entre 2 e 40 caracteres.' });
  if (email.length > 254 || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Informe um e-mail válido.' });
  if (password.length < PASSWORD_MIN || password.length > 128) return res.status(400).json({ error: 'A senha deve ter entre 10 e 128 caracteres.' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const encoded = await passwordHash(password);
    const created = await client.query('INSERT INTO vortex_users (email, password_hash) VALUES ($1, $2) RETURNING id, email', [email, encoded]);
    const user = created.rows[0];
    await client.query('INSERT INTO vortex_profiles (user_id, name, avatar_key) VALUES ($1, $2, $3)', [user.id, name, 'vortex']);
    const token = await createSession(client, user.id);
    await client.query('COMMIT');
    res.status(201).json({ token, user: { id: user.id, email: user.email, name }, profiles: [{ name, avatar: 'vortex', kids: false }] });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ error: 'Já existe uma conta com esse e-mail. Entre ou use outro e-mail.' });
    if (error.code === '42P01' || error.code === '42703') return res.status(503).json({ error: 'O banco ainda não está preparado. Aplique a migração database/migrations/002_auth.sql.' });
    console.error('[VORTEX AUTH] Falha no cadastro:', error.message);
    res.status(500).json({ error: 'Não foi possível criar a conta agora.' });
  } finally { client?.release(); }
});

router.post('/login', checkRateLimit, async (req, res) => {
  if (unavailable(res)) return;
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  if (!EMAIL_RE.test(email) || !password || password.length > 128) return res.status(400).json({ error: 'Confira o e-mail e a senha.' });
  let client;
  try {
    client = await pool.connect();
    await client.query('BEGIN');
    const found = await client.query('SELECT id, email, password_hash FROM vortex_users WHERE email = $1', [email]);
    const row = found.rows[0];
    const valid = row ? await verifyPassword(password, row.password_hash) : false;
    if (!valid) { await client.query('ROLLBACK'); return res.status(401).json({ error: 'E-mail ou senha incorretos.' }); }
    const profileResult = await client.query('SELECT name FROM vortex_profiles WHERE user_id = $1 ORDER BY created_at LIMIT 1', [row.id]);
    const token = await createSession(client, row.id);
    await client.query('COMMIT');
    res.json({ token, user: cleanUser({ ...row, name: profileResult.rows[0]?.name }) });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[VORTEX AUTH] Falha no login:', error.message);
    res.status(500).json({ error: 'Não foi possível entrar agora.' });
  } finally { client?.release(); }
});

router.get('/me', async (req, res) => {
  if (unavailable(res)) return;
  try {
    const session = await sessionUser(req);
    if (!session) return res.status(401).json({ error: 'Sessão expirada. Entre novamente.' });
    res.json({ user: session.user });
  } catch (error) {
    console.error('[VORTEX AUTH] Falha ao consultar sessão:', error.message);
    res.status(500).json({ error: 'Não foi possível validar a sessão.' });
  }
});

router.post('/logout', async (req, res) => {
  if (unavailable(res)) return;
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) {
    try { await pool.query('DELETE FROM vortex_sessions WHERE token_hash = $1', [hashToken(token)]); }
    catch (error) { console.error('[VORTEX AUTH] Falha ao encerrar sessão:', error.message); return res.status(500).json({ error: 'Não foi possível encerrar a sessão no servidor.' }); }
  }
  res.json({ ok: true });
});

export default router;
