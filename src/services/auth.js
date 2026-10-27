const API_BASE = (import.meta.env.VITE_API_BASE_URL || 'https://vortex-stream-u8wz.onrender.com').replace(/\/+$/, '');
const TOKEN_KEY = 'vortex.auth.token.v1';

function readToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function saveToken(token) {
  try { if (token) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY); } catch { /* storage may be disabled */ }
}

async function authRequest(path, { method = 'GET', body, token = readToken() } = {}) {
  const headers = { Accept: 'application/json' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw new Error('Não foi possível conectar ao servidor do VORTEX. Verifique a API e tente novamente.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Falha na autenticação (HTTP ${response.status}).`);
  return data;
}

export const authService = {
  status: 'connected-to-api',
  async signIn({ email, password }) {
    const data = await authRequest('/api/auth/login', { method: 'POST', body: { email, password }, token: null });
    saveToken(data.token);
    return data;
  },
  async signUp({ name, email, password }) {
    const data = await authRequest('/api/auth/register', { method: 'POST', body: { name, email, password }, token: null });
    saveToken(data.token);
    return data;
  },
  async signOut() {
    try { await authRequest('/api/auth/logout', { method: 'POST' }); } finally { saveToken(null); }
    return true;
  },
  async getSession() {
    const token = readToken();
    if (!token) return null;
    try { return await authRequest('/api/auth/me', { token }); }
    catch (error) {
      saveToken(null);
      if (/conectar ao servidor/i.test(error.message)) throw error;
      return null;
    }
  },
};
