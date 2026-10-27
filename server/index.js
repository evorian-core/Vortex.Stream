
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '32kb' }));

// Autenticação
import authRoutes from './routes/auth.js';
app.use('/api/auth', authRoutes);

// Adaptador de catálogo e reprodução
let adapter;

try {
  adapter = await import('./providers/superflixAdapter.js');
  console.log('[VORTEX] SuperFlix + TMDB Adapter carregado');
} catch (error) {
  console.error('[VORTEX] Erro ao carregar o adapter:', error);
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    superflix: process.env.SUPERFLIX_ENABLED === 'true',
    auth: true
  });
});

// Catálogo
app.get('/api/catalog', async (req, res) => {
  try {
    if (!adapter) {
      return res.status(503).json({
        error: 'Adaptador de catálogo indisponível',
        items: []
      });
    }

    const rawLimit = Number(req.query.limit || 100);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(rawLimit, 1), 500)
      : 100;

    const catalog = await adapter.getProviderCatalog({ limit });
    res.json(catalog);
  } catch (error) {
    console.error('[VORTEX] Erro no catálogo:', error);
    res.status(500).json({
      error: 'Não foi possível carregar o catálogo',
      items: []
    });
  }
});

// Busca
app.get('/api/search', async (req, res) => {
  const q = String(req.query.q || '').trim();

  if (!q) {
    return res.json([]);
  }

  try {
    if (!adapter) {
      return res.status(503).json({
        error: 'Adaptador de busca indisponível'
      });
    }

    const results = await adapter.searchProvider(q);
    res.json(results);
  } catch (error) {
    console.error('[VORTEX] Erro na busca:', error);
    res.status(500).json({
      error: 'Não foi possível realizar a busca'
    });
  }
});

// Reprodução
app.get('/api/playback/:id', async (req, res) => {
  try {
    if (!adapter) {
      return res.status(503).json({
        error: 'Adaptador de reprodução indisponível'
      });
    }

    const playback = await adapter.getPlayback(req.params.id);
    res.json(playback);
  } catch (error) {
    console.error('[VORTEX] Erro no playback:', error);
    res.status(500).json({
      error: 'Não foi possível obter a reprodução'
    });
  }
});

// Tratamento de rotas inexistentes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint da API não encontrado',
    path: req.originalUrl
  });
});

// Inicialização
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[VORTEX] API iniciada na porta ${PORT}`);
  console.log('[VORTEX] Rotas de autenticação registradas em /api/auth');
});
