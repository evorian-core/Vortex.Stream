const API_BASE = 'https://vortex-stream-u8wz.onrender.com';

async function request(path) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error(`API retornou HTTP ${response.status}: ${path}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(
      `A API não retornou JSON em ${path}. ` +
      `Content-Type recebido: ${contentType || 'desconhecido'}.`
    );
  }

  return response.json();
}

export async function fetchCatalog() {
  try {
    const data = await request('/api/catalog?limit=100');
    return Array.isArray(data) ? data : (data.items || []);
  } catch (error) {
    console.error('[VORTEX] Falha ao carregar catálogo:', error);
    return null;
  }
}

export async function fetchSearch(query) {
  const q = String(query || '').trim();

  if (!q) return [];

  try {
    const data = await request(`/api/search?q=${encodeURIComponent(q)}`);
    return Array.isArray(data) ? data : (data.items || []);
  } catch (error) {
    console.error('[VORTEX] Falha na pesquisa:', error);
    return [];
  }
}

export async function fetchPlayback(id) {
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Não foi informado um ID válido para reprodução.');
  }

  return request(`/api/playback/${encodeURIComponent(String(id))}`);
}

const TOP_TEN_CACHE_KEY = 'vortex.top-ten.trending.v2';
const TOP_TEN_CACHE_MAX_AGE = 60 * 60 * 1000;

function readTopTenCache() {
  try {
    const cached = JSON.parse(
      localStorage.getItem(TOP_TEN_CACHE_KEY) || 'null'
    );

    if (!cached || !Array.isArray(cached.items)) {
      return null;
    }

    return {
      items: cached.items,
      savedAt: Number(cached.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function getCachedTopTen() {
  const cached = readTopTenCache();
  return cached?.items?.length ? cached.items : null;
}

function titleKind(item) {
  const raw = String(
    item?.type ||
    item?.media_type ||
    item?.mediaType ||
    item?.providerCategory ||
    ''
  ).toLowerCase();

  if (['movie', 'film', 'filme', 'movies'].includes(raw)) {
    return 'movie';
  }

  if (
    ['tv', 'serie', 'série', 'series', 'show', 'television'].includes(raw)
  ) {
    return 'series';
  }

  return raw ? null : 'unknown';
}

function trendScore(item) {
  const values = [
    item.trending_score,
    item.trendingScore,
    item.trend_score,
    item.popularity,
    item.trending,
    item.rank_score,
    item.rankScore,
  ];

  for (const value of values) {
    const number = Number(value);

    if (Number.isFinite(number) && number > 0) {
      return number;
    }
  }

  const votes =
    Number(
      item.vote_count ??
      item.voteCount ??
      item.votes ??
      0
    ) || 0;

  const rating =
    Number(
      item.vote_average ??
      item.voteAverage ??
      item.rating ??
      0
    ) || 0;

  return votes > 0
    ? Math.log10(votes + 1) * 10 + rating
    : rating;
}


/**
 * Busca os metadados de uma série e suas temporadas.
 * O ID pode ser numérico ou estar no formato "series-71912".
 */
export async function fetchSeriesDetails(id) {
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Não foi informado um ID válido para a série.');
  }

  const data = await request(
    `/api/series/${encodeURIComponent(String(id))}`
  );

  if (!data || !Array.isArray(data.seasons)) {
    throw new Error('A API não retornou as temporadas da série.');
  }

  return data;
}

/**
 * Busca os episódios de uma temporada específica.
 */
export async function fetchSeasonEpisodes(id, seasonNumber) {
  if (id === undefined || id === null || String(id).trim() === '') {
    throw new Error('Não foi informado um ID válido para a série.');
  }

  const number = Number(seasonNumber);

  if (!Number.isInteger(number) || number < 1) {
    throw new Error('Número de temporada inválido.');
  }

  const data = await request(
    `/api/series/${encodeURIComponent(String(id))}/seasons/${number}`
  );

  if (!data || !Array.isArray(data.episodes)) {
    throw new Error('A API não retornou os episódios da temporada.');
  }

  return data;
}


function normalizeTrendingItem(item, index) {
  const kind = titleKind(item);

  const type =
    kind === 'movie' || kind === 'series'
      ? kind
      : (item.type || 'movie');

  return {
    ...item,

    id:
      item.id ??
      item.tmdb_id ??
      item.providerId ??
      `trending-${index}-${item.title || item.name || 'title'}`,

    title:
      item.title ||
      item.name ||
      item.original_title ||
      item.original_name ||
      'Título sem nome',

    type,

    synopsis:
      item.synopsis ||
      item.overview ||
      item.description ||
      '',

    poster:
      item.poster ||
      item.poster_path_url ||
      (
        item.poster_path
          ? `https://image.tmdb.org/t/p/w500${item.poster_path}`
          : ''
      ),

    backdrop:
      item.backdrop ||
      item.backdrop_path_url ||
      (
        item.backdrop_path
          ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
          : ''
      ),

    year:
      item.year ||
      String(
        item.release_date ||
        item.first_air_date ||
        ''
      ).slice(0, 4) ||
      null,

    genre:
      item.genre ||
      (type === 'series' ? 'Série' : 'Filme'),
  };
}

function buildTrendingTopTen(source) {
  if (!Array.isArray(source)) {
    return [];
  }

  const eligible = source
    .map((item, index) => ({
      ...normalizeTrendingItem(item, index),
      __sourceIndex: index,
      __kind: titleKind(item),
    }))
    .filter(
      item =>
        item.__kind === 'movie' ||
        item.__kind === 'series' ||
        item.__kind === 'unknown'
    );

  const hasExplicitRanking = eligible.some(
    item =>
      Number.isFinite(Number(item.trending_rank)) &&
      Number(item.trending_rank) > 0
  );

  if (hasExplicitRanking) {
    eligible.sort(
      (a, b) =>
        (
          Number(a.trending_rank) ||
          Number.MAX_SAFE_INTEGER
        ) -
          (
            Number(b.trending_rank) ||
            Number.MAX_SAFE_INTEGER
          ) ||
        a.__sourceIndex - b.__sourceIndex
    );
  } else {
    eligible.sort(
      (a, b) =>
        trendScore(b) - trendScore(a) ||
        a.__sourceIndex - b.__sourceIndex
    );
  }

  const seen = new Set();

  return eligible
    .filter(item => {
      const key = String(item.id ?? item.title).toLowerCase();

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 10)
    .map(({ __sourceIndex, __kind, ...item }) => item);
}

function cacheTopTen(items) {
  try {
    localStorage.setItem(
      TOP_TEN_CACHE_KEY,
      JSON.stringify({
        items,
        savedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn(
      '[VORTEX] Não foi possível salvar o cache do Top 10:',
      error
    );
  }
}

/**
 * Atualiza o Top 10.
 *
 * Prioridade:
 * 1. Endpoint de tendências do backend.
 * 2. Catálogo remoto real, caso esteja disponível.
 * 3. Cache salvo anteriormente.
 *
 * O catálogo demonstrativo local não é usado automaticamente
 * para inventar um ranking de tendências.
 */
export async function fetchTopTen(catalogOverride) {
  const cached = readTopTenCache();

  try {
    // Tenta carregar tendências reais do backend.
    try {
      const trendingData = await request(
        '/api/trending?window=day&limit=40'
      );

      const trendingItems = Array.isArray(trendingData)
        ? trendingData
        : (trendingData.items || []);

      const items = buildTrendingTopTen(trendingItems);

      if (items.length) {
        cacheTopTen(items);
        return items;
      }
    } catch (trendingError) {
      console.warn(
        '[VORTEX] Endpoint /api/trending indisponível. ' +
        'O backend publicado precisa implementar essa rota. ' +
        'Tentando o catálogo remoto.'
      );
    }

    // Compatibilidade com o backend atual.
    const catalog = Array.isArray(catalogOverride)
      ? catalogOverride
      : await fetchCatalog();

    if (Array.isArray(catalog) && catalog.length) {
      const items = buildTrendingTopTen(catalog);

      if (items.length) {
        cacheTopTen(items);
        return items;
      }
    }
  } catch (error) {
    console.error(
      '[VORTEX] Falha ao atualizar Top 10:',
      error
    );
  }

  // Usa o último ranking salvo se as consultas falharem.
  if (cached?.items?.length) {
    return cached.items;
  }

  return null;
}

export async function sendPlaybackEvent() {
  return;
}