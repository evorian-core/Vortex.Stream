
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '32kb' }));

// Autenticação existente
app.use('/api/auth', authRoutes);

// Adaptador de catálogo, temporadas e reprodução
let adapter;

try {
  adapter = await import('./providers/superflixAdapter.js');
  console.log('[VORTEX] SuperFlix + TMDB Adapter carregado');
} catch (error) {
  console.error(
    '[VORTEX] Erro ao carregar o adapter:',
    error
  );
}

// Extrai o ID numérico de identificadores como:
// 71912
// serie-71912
// anime-71912
function normalizeSeriesId(value) {
  const id = String(value || '').trim();

  if (/^\d+$/.test(id)) {
    return id;
  }

  const match = id.match(/^(?:serie|series|anime|dorama)-(\d+)$/i);

  return match ? match[1] : null;
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    superflix: process.env.SUPERFLIX_ENABLED === 'true',
    auth: true,
    tmdbConfigured: Boolean(process.env.TMDB_API_KEY),
  });
});

// Catálogo
app.get('/api/catalog', async (req, res) => {
  try {
    if (!adapter) {
      return res.status(503).json({
        error: 'Adaptador de catálogo indisponível',
        items: [],
      });
    }

    const rawLimit = Number(req.query.limit || 100);

    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 500)
      : 100;

    const catalog = await adapter.getProviderCatalog({ limit });

    return res.json(catalog);
  } catch (error) {
    console.error('[VORTEX] Erro no catálogo:', error);

    return res.status(500).json({
      error: 'Não foi possível carregar o catálogo',
      items: [],
    });
  }
});


/**
 * Tendências
 * GET /api/trending?window=day&limit=40
 *
 * Usa o catálogo real do adaptador.
 * Quando existem campos de popularidade, eles são usados
 * para ordenar os resultados. Sem esses campos, preserva
 * a ordem original do provedor.
 */

app.get('/api/trending', async (req, res) => {
  try {
    if (!adapter || typeof adapter.getTrending !== 'function') {
      return res.status(503).json({
        error: 'Consulta de tendências indisponível',
        items: [],
      });
    }

    const window = req.query.window === 'week'
      ? 'week'
      : 'day';

    const rawLimit = Number(req.query.limit ?? 40);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 100)
      : 40;

    const items = await adapter.getTrending(window, limit);

    return res.json({
      items,
      window,
      source: 'tmdb-trending',
    });
  } catch (error) {
    console.error('[VORTEX] Erro nas tendências:', error);

    return res.status(502).json({
      error: 'Não foi possível carregar as tendências da TMDB',
      items: [],
    });
  }
});


// Busca
app.get('/api/search', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (!query) {
    return res.json([]);
  }

  try {
    if (!adapter) {
      return res.status(503).json({
        error: 'Adaptador de busca indisponível',
      });
    }

    const results = await adapter.searchProvider(query);

    return res.json(results);
  } catch (error) {
    console.error('[VORTEX] Erro na busca:', error);

    return res.status(500).json({
      error: 'Não foi possível realizar a busca',
    });
  }
});

// Detalhes da série e lista real de temporadas
// Exemplo: GET /api/series/71912
// Também aceita IDs como serie-71912.
app.get('/api/series/:id', async (req, res) => {
  try {
    if (!adapter) {
      return res.status(503).json({
        error: 'Adaptador de séries indisponível',
      });
    }

    if (typeof adapter.getSeriesDetails !== 'function') {
      return res.status(503).json({
        error: 'Consulta de temporadas não está disponível no adapter',
      });
    }

    const tmdbId = normalizeSeriesId(req.params.id);

    if (!tmdbId) {
      return res.status(400).json({
        error: 'ID da série inválido. Informe um ID numérico da TMDB.',
      });
    }

    // Retorna a lista de temporadas sem buscar os episódios
    // de todas elas antecipadamente.
    const details = await adapter.getSeriesDetails(tmdbId, {
      includeEpisodes: false,
    });

    return res.json(details);
  } catch (error) {
    console.error('[VORTEX] Erro nos detalhes da série:', error);

    const message = String(error.message || '');

    if (
      message.includes('TMDB_API_KEY não configurada')
    ) {
      return res.status(503).json({
        error: 'A chave da TMDB não está configurada no servidor.',
      });
    }

    if (
      message.includes('ID TMDB inválido')
    ) {
      return res.status(400).json({
        error: 'ID da série inválido.',
      });
    }

    if (message.includes('HTTP 404')) {
      return res.status(404).json({
        error: 'Série não encontrada na TMDB.',
      });
    }

    return res.status(502).json({
      error: 'Não foi possível obter os detalhes da série.',
    });
  }
});

// Episódios reais de uma temporada específica
// Exemplo: GET /api/series/71912/seasons/1
// Temporada 0 também é aceita para especiais, quando existente.
app.get(
  '/api/series/:id/seasons/:seasonNumber',
  async (req, res) => {
    try {
      if (!adapter) {
        return res.status(503).json({
          error: 'Adaptador de temporadas indisponível',
        });
      }

      if (typeof adapter.getSeasonDetails !== 'function') {
        return res.status(503).json({
          error: 'Consulta de episódios não está disponível no adapter',
        });
      }

      const tmdbId = normalizeSeriesId(req.params.id);
      const seasonNumber = Number(req.params.seasonNumber);

      if (!tmdbId) {
        return res.status(400).json({
          error: 'ID da série inválido.',
        });
      }

      if (
        !/^\d+$/.test(req.params.seasonNumber) ||
        !Number.isSafeInteger(seasonNumber) ||
        seasonNumber < 0
      ) {
        return res.status(400).json({
          error: 'Número de temporada inválido.',
        });
      }

      const season = await adapter.getSeasonDetails(
        tmdbId,
        seasonNumber
      );

      return res.json(season);
    } catch (error) {
      console.error(
        '[VORTEX] Erro ao carregar temporada:',
        error
      );

      const message = String(error.message || '');

      if (
        message.includes('TMDB_API_KEY não configurada')
      ) {
        return res.status(503).json({
          error: 'A chave da TMDB não está configurada no servidor.',
        });
      }

      if (
        message.includes('ID TMDB inválido') ||
        message.includes('Número de temporada inválido')
      ) {
        return res.status(400).json({
          error: 'ID ou número de temporada inválido.',
        });
      }

      if (message.includes('HTTP 404')) {
        return res.status(404).json({
          error: 'Temporada não encontrada na TMDB.',
        });
      }

      return res.status(502).json({
        error: 'Não foi possível obter os episódios desta temporada.',
      });
    }
  }
);

// Reprodução
app.get('/api/playback/:id', async (req, res) => {
  try {
    if (!adapter) {
      return res.status(503).json({
        error: 'Adaptador de reprodução indisponível',
      });
    }

    const playback = await adapter.getPlayback(req.params.id);

    return res.json(playback);
  } catch (error) {
    console.error('[VORTEX] Erro no playback:', error);

    return res.status(500).json({
      error: 'Não foi possível obter a reprodução',
    });
  }
});

// Tratamento de rotas inexistentes
app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Endpoint da API não encontrado',
    path: req.originalUrl,
  });
});

// Inicialização
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[VORTEX] API iniciada na porta ${PORT}`);
  console.log('[VORTEX] Autenticação: /api/auth');
  console.log('[VORTEX] Catálogo: /api/catalog');
  console.log('[VORTEX] Tendências: /api/trending');
  console.log('[VORTEX] Busca: /api/search');
  console.log('[VORTEX] Séries: /api/series/:id');
  console.log(
    '[VORTEX] Temporadas: /api/series/:id/seasons/:seasonNumber'
  );
  console.log('[VORTEX] Reprodução: /api/playback/:id');
});
