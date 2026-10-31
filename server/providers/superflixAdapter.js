
const SUPERFLIX_BASE = (
  process.env.SUPERFLIX_BASE_URL || 'https://superflixapi.fun'
).replace(/\/+$/, '');

const TMDB_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP = 'https://image.tmdb.org/t/p/w1280';

async function fetchJSON(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'VORTEX/4.0' },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

function tmdbUrl(path, params = {}) {
  const url = new URL(`${TMDB_BASE}${path}`);

  if (TMDB_KEY) {
    url.searchParams.set('api_key', TMDB_KEY);
  }

  url.searchParams.set('language', 'pt-BR');

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value));
    }
  }

  return url.toString();
}

function normalizeId(item) {
  if (typeof item === 'string' || typeof item === 'number') {
    return String(item).trim();
  }

  if (!item) return '';

  return String(
    item.tmdb_id ||
    item.id ||
    item.imdb_id ||
    ''
  ).trim();
}

function isMovieCategory(category) {
  return ['filme', 'movie', 'filmes'].includes(
    String(category || '').toLowerCase()
  );
}

function getImage(path, base = TMDB_IMAGE) {
  return path ? `${base}${path}` : null;
}

function getYear(data, isMovie) {
  const date = isMovie
    ? data.release_date
    : data.first_air_date;

  return date ? date.slice(0, 4) : null;
}

/**
 * Busca os metadados gerais de um filme ou série.
 * Não inventa temporadas nem episódios.
 */
async function enrichWithTMDB(tmdbId, isMovie = true) {
  if (
    !TMDB_KEY ||
    !tmdbId ||
    String(tmdbId).startsWith('tt') ||
    !/^\d+$/.test(String(tmdbId))
  ) {
    return null;
  }

  try {
    const type = isMovie ? 'movie' : 'tv';
    const data = await fetchJSON(
      tmdbUrl(`/${type}/${tmdbId}`)
    );

    return {
      title: data.title || data.name,
      originalTitle:
        data.original_title || data.original_name,
      synopsis: data.overview || 'Sem sinopse disponível.',
      year: getYear(data, isMovie),
      poster: getImage(data.poster_path),
      backdrop: getImage(data.backdrop_path, TMDB_BACKDROP),
      rating:
        typeof data.vote_average === 'number'
          ? data.vote_average.toFixed(1)
          : null,
      genre: data.genres?.[0]?.name ||
        (isMovie ? 'Filme' : 'Série'),
      numberOfSeasons: isMovie
        ? undefined
        : data.number_of_seasons,
      numberOfEpisodes: isMovie
        ? undefined
        : data.number_of_episodes,
      status: isMovie ? undefined : data.status,
    };
  } catch (error) {
    console.warn(
      `[VORTEX] Falha ao buscar metadados TMDB (${tmdbId}):`,
      error.message
    );

    return null;
  }
}

/**
 * Converte um item do catálogo para o formato do VORTEX.
 *
 * IMPORTANTE:
 * Os dados de temporadas não são simulados aqui.
 * Eles serão carregados pela função getSeriesDetails().
 */
function toVortexItem(rawId, category, tmdbInfo = null) {
  const providerId = normalizeId(rawId);

  if (!providerId) return null;

  const isMovie = isMovieCategory(category);
  const title = tmdbInfo?.title || `${category} ${providerId}`;

  const item = {
    id: `${category}-${providerId}`,
    providerId,
    providerCategory: category,
    title,
    originalTitle: tmdbInfo?.originalTitle || title,
    type: isMovie ? 'movie' : 'series',
    year: tmdbInfo?.year || null,
    rating: tmdbInfo?.rating || null,
    genre: tmdbInfo?.genre || category,
    synopsis: tmdbInfo?.synopsis || 'Sinopse indisponível.',
    director: 'SuperFlix',
    cast: [],
    poster:
      tmdbInfo?.poster ||
      `https://placehold.co/400x600/0e1428/8dbdff?text=${encodeURIComponent(title.slice(0, 20))}`,
    backdrop:
      tmdbInfo?.backdrop ||
      tmdbInfo?.poster ||
      `https://placehold.co/1200x600/08090d/8dbdff?text=${encodeURIComponent(title.slice(0, 20))}`,
    featured: false,
  };

  if (isMovie) {
    item.duration = 'Duração indisponível';
  } else {
    item.numberOfSeasons = tmdbInfo?.numberOfSeasons ?? null;
    item.numberOfEpisodes = tmdbInfo?.numberOfEpisodes ?? null;
    item.status = tmdbInfo?.status ?? null;

    // Não atribuímos seasons aqui.
    // A estrutura real será obtida pela API de temporadas.
  }

  return item;
}

/**
 * Obtém os episódios reais de uma temporada da TMDB.
 *
 * Exemplo:
 * GET /tv/71912/season/1
 */
export async function getSeasonDetails(tmdbId, seasonNumber) {
  if (!TMDB_KEY) {
    throw new Error('TMDB_API_KEY não configurada.');
  }

  if (!/^\d+$/.test(String(tmdbId))) {
    throw new Error('ID TMDB inválido.');
  }

  if (
    !Number.isInteger(Number(seasonNumber)) ||
    Number(seasonNumber) < 0
  ) {
    throw new Error('Número de temporada inválido.');
  }

  const data = await fetchJSON(
    tmdbUrl(`/tv/${tmdbId}/season/${seasonNumber}`)
  );

  return {
    id: data.id,
    number: data.season_number,
    name: data.name || `Temporada ${data.season_number}`,
    overview: data.overview || '',
    poster: getImage(data.poster_path),
    airDate: data.air_date || null,
    episodes: (data.episodes || []).map((episode) => ({
      id: episode.id,
      number: episode.episode_number,
      seasonNumber: episode.season_number,
      title: episode.name || `Episódio ${episode.episode_number}`,
      synopsis: episode.overview || '',
      airDate: episode.air_date || null,
      duration: episode.runtime
        ? `${episode.runtime} min`
        : null,
      still: getImage(episode.still_path),
      rating:
        typeof episode.vote_average === 'number'
          ? episode.vote_average.toFixed(1)
          : null,
    })),
  };
}

/**
 * Obtém a série e todas as suas temporadas reais.
 *
 * O parâmetro includeEpisodes controla se os episódios
 * serão carregados imediatamente.
 */
export async function getSeriesDetails(
  tmdbId,
  { includeEpisodes = true } = {}
) {
  if (!TMDB_KEY) {
    throw new Error('TMDB_API_KEY não configurada.');
  }

  if (!/^\d+$/.test(String(tmdbId))) {
    throw new Error('ID TMDB inválido.');
  }

  const data = await fetchJSON(
    tmdbUrl(`/tv/${tmdbId}`)
  );

  const seasonList = (data.seasons || [])
    .filter((season) => Number.isInteger(season.season_number))
    .sort((a, b) => a.season_number - b.season_number);

  const seasons = await Promise.all(
    seasonList.map(async (season) => {
      const basicSeason = {
        id: season.id,
        number: season.season_number,
        name: season.name ||
          `Temporada ${season.season_number}`,
        overview: season.overview || '',
        poster: getImage(season.poster_path),
        airDate: season.air_date || null,
        episodeCount: season.episode_count || 0,
      };

      if (!includeEpisodes) {
        return basicSeason;
      }

      try {
        return await getSeasonDetails(
          tmdbId,
          season.season_number
        );
      } catch (error) {
        console.warn(
          `[VORTEX] Não foi possível carregar a temporada ${season.season_number}:`,
          error.message
        );

        // Não inventa episódios quando a TMDB falha.
        return {
          ...basicSeason,
          episodes: null,
          unavailable: true,
        };
      }
    })
  );

  return {
    id: data.id,
    title: data.name,
    originalTitle: data.original_name,
    synopsis: data.overview || '',
    poster: getImage(data.poster_path),
    backdrop: getImage(data.backdrop_path, TMDB_BACKDROP),
    year: getYear(data, false),
    rating:
      typeof data.vote_average === 'number'
        ? data.vote_average.toFixed(1)
        : null,
    status: data.status || null,
    numberOfSeasons: data.number_of_seasons ?? seasons.length,
    numberOfEpisodes: data.number_of_episodes ?? null,
    seasons,
  };
}

async function listByCategory(category, limit = 60) {
  const url = new URL(`${SUPERFLIX_BASE}/lista`);

  url.searchParams.set('category', category);
  url.searchParams.set('format', 'json');
  url.searchParams.set('type', 'tmdb');
  url.searchParams.set('limit', String(limit));

  try {
    const data = await fetchJSON(url.toString());

    return Array.isArray(data)
      ? data
      : data.items || data.results || data.data || [];
  } catch (error) {
    console.warn(
      `[VORTEX] Erro ao carregar ${category}:`,
      error.message
    );

    return [];
  }
}

/**
 * Catálogo principal.
 * Não carrega todos os episódios de todas as séries
 * durante a abertura da página inicial.
 */
export async function getProviderCatalog(opts = {}) {
  const limit = opts.limit || 100;

  const [movies, series, anime, doramas] = await Promise.all([
    listByCategory('filme', limit),
    listByCategory('serie', limit),
    listByCategory('anime', 40),
    listByCategory('dorama', 40),
  ]);

  const entries = [
    ...movies
      .slice(0, Math.floor(limit * 0.4))
      .map((id) => ({ id, category: 'filme', isMovie: true })),

    ...series
      .slice(0, Math.floor(limit * 0.3))
      .map((id) => ({ id, category: 'serie', isMovie: false })),

    ...anime
      .slice(0, Math.floor(limit * 0.15))
      .map((id) => ({ id, category: 'anime', isMovie: false })),

    ...doramas
      .slice(0, Math.floor(limit * 0.15))
      .map((id) => ({ id, category: 'dorama', isMovie: false })),
  ];

  const enriched = await Promise.all(
    entries.map(async ({ id, category, isMovie }) => {
      const rawId = normalizeId(id);

      const info = await enrichWithTMDB(rawId, isMovie);

      return toVortexItem(rawId, category, info);
    })
  );

  const items = enriched.filter(Boolean);

  if (items.length > 0) {
    items[0].featured = true;
  }

  return items;
}

/**
 * Busca títulos no provedor e na TMDB.
 * Os resultados da TMDB mantêm o tipo correto.
 */
export async function searchProvider(query) {
  if (!query?.trim()) return [];

  const results = [];

  // 1. Busca no catálogo SuperFlix.
  try {
    const url = new URL(`${SUPERFLIX_BASE}/lista`);

    url.searchParams.set('category', 'pesquisa');
    url.searchParams.set('q', query.trim());
    url.searchParams.set('format', 'json');
    url.searchParams.set('limit', '30');

    const data = await fetchJSON(url.toString());

    const entries = Array.isArray(data)
      ? data
      : data.items || data.results || [];

    const enriched = await Promise.all(
      entries.slice(0, 10).map(async (entry) => {
        const rawId = normalizeId(entry);

        if (!rawId) return null;

        // A busca do provedor pode misturar filmes e séries.
        // Sem tipo confiável, não presumimos que tudo seja filme.
        const category = String(
          entry?.category ||
          entry?.type ||
          entry?.media_type ||
          ''
        ).toLowerCase();

        const isMovie = isMovieCategory(category);

        const info = await enrichWithTMDB(rawId, isMovie);

        return toVortexItem(
          rawId,
          isMovie ? 'filme' : 'serie',
          info
        );
      })
    );

    results.push(...enriched.filter(Boolean));
  } catch (error) {
    console.warn(
      '[VORTEX] Busca SuperFlix falhou:',
      error.message
    );
  }

  // 2. Busca diretamente na TMDB.
  if (TMDB_KEY) {
    try {
      const [movieData, tvData] = await Promise.all([
        fetchJSON(
          tmdbUrl('/search/movie', { query: query.trim() })
        ).catch(() => ({ results: [] })),

        fetchJSON(
          tmdbUrl('/search/tv', { query: query.trim() })
        ).catch(() => ({ results: [] })),
      ]);

      const movies = (movieData.results || [])
        .slice(0, 12)
        .map((movie) =>
          toVortexItem(String(movie.id), 'filme', {
            title: movie.title,
            originalTitle: movie.original_title,
            synopsis: movie.overview,
            year: getYear(movie, true),
            poster: getImage(movie.poster_path),
            backdrop: getImage(
              movie.backdrop_path,
              TMDB_BACKDROP
            ),
            rating:
              typeof movie.vote_average === 'number'
                ? movie.vote_average.toFixed(1)
                : null,
            genre: 'Filme',
          })
        );

      const tvSeries = (tvData.results || [])
        .slice(0, 12)
        .map((show) =>
          toVortexItem(String(show.id), 'serie', {
            title: show.name,
            originalTitle: show.original_name,
            synopsis: show.overview,
            year: getYear(show, false),
            poster: getImage(show.poster_path),
            backdrop: getImage(
              show.backdrop_path,
              TMDB_BACKDROP
            ),
            rating:
              typeof show.vote_average === 'number'
                ? show.vote_average.toFixed(1)
                : null,
            genre: 'Série',
          })
        );

      results.push(...movies, ...tvSeries);
    } catch (error) {
      console.warn(
        '[VORTEX] Busca TMDB falhou:',
        error.message
      );
    }
  }

  // Remove duplicatas mantendo o tipo de mídia no identificador.
  const seen = new Set();

  return results.filter((item) => {
    if (!item) return false;

    const key = `${item.type}:${item.providerId}`;

    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });
}

/**
 * Constrói os links de reprodução da SuperFlix.
 * A existência de metadados na TMDB não garante
 * que o provedor tenha o episódio disponível.
 */
export async function getPlayback(contentId) {
  const id = String(contentId || '');

  let raw = id;

  if (id.includes('-')) {
    const imdbMatch = id.match(/tt\d+/);

    raw = imdbMatch
      ? imdbMatch[0]
      : id.split('-').slice(1).join('-');
  }

  const isMovie =
    id.startsWith('filme-') ||
    id.startsWith('movie-') ||
    /tt\d+/.test(raw);

  const type = isMovie ? 'filme' : 'serie';
  const basePlayer = `${SUPERFLIX_BASE}/${type}/${raw}`;

  return {
    id,
    providerId: raw,
    type,
    playerUrl: basePlayer,
    playerUrlNoList: `${basePlayer}#noEpList`,
    playerUrlCustom:
      `${basePlayer}#noEpList#color:8dbdff#transparent`,

    buildUrl: (
      season = 1,
      episode = 1,
      hashes = '#noEpList'
    ) => {
      if (isMovie) {
        return `${basePlayer}${hashes || ''}`;
      }

      return (
        `${SUPERFLIX_BASE}/serie/${raw}/` +
        `${season}/${episode}${hashes || ''}`
      );
    },
  };
}

export async function getChannels() {
  return listByCategory('canais', 40);
}

export async function getEvents(sport = '') {
  const url = new URL(`${SUPERFLIX_BASE}/lista`);

  url.searchParams.set('category', 'eventos');
  url.searchParams.set('format', 'json');

  if (sport) {
    url.searchParams.set('sport', sport);
  }

  try {
    return await fetchJSON(url.toString());
  } catch {
    return [];
  }
}


/**
 * Tendências reais da TMDB.
 *
 * window: "day" ou "week"
 * Retorna títulos no formato usado pelo VORTEX.
 */

/**
 * Tendências reais da TMDB.
 *
 * window: "day" ou "week"
 * limit: quantidade solicitada, de 1 a 100.
 *
 * Retorna títulos no formato usado pelo VORTEX.
 */
export async function getTrending(window = 'day', limit = 40) {
  if (!TMDB_KEY) {
    throw new Error('TMDB_API_KEY não configurada.');
  }

  const timeWindow = window === 'week' ? 'week' : 'day';

  const parsedLimit = Number(limit);
  const safeLimit = Math.min(
    Math.max(
      Math.floor(Number.isFinite(parsedLimit) ? parsedLimit : 40),
      1
    ),
    100
  );

  const collected = [];
  const maxPages = Math.ceil(safeLimit / 20);

  for (let page = 1; page <= maxPages; page += 1) {
    const data = await fetchJSON(
      tmdbUrl(`/trending/all/${timeWindow}`, { page })
    );

    const results = Array.isArray(data.results)
      ? data.results
      : [];

    collected.push(...results);

    // A TMDB normalmente fornece até 20 itens por página.
    if (
      results.length === 0 ||
      collected.length >= safeLimit ||
      page >= Number(data.total_pages || maxPages)
    ) {
      break;
    }
  }

  return collected
    .filter((entry) =>
      ['movie', 'tv'].includes(entry.media_type)
    )
    .slice(0, safeLimit)
    .map((entry) => {
      const isMovie = entry.media_type === 'movie';
      const category = isMovie ? 'filme' : 'serie';

      const item = toVortexItem(
        String(entry.id),
        category,
        {
          title: entry.title || entry.name,
          originalTitle:
            entry.original_title || entry.original_name,
          synopsis: entry.overview || '',
          year: getYear(entry, isMovie),
          poster: getImage(entry.poster_path),
          backdrop: getImage(
            entry.backdrop_path,
            TMDB_BACKDROP
          ),
          rating:
            typeof entry.vote_average === 'number'
              ? entry.vote_average.toFixed(1)
              : null,
          genre: isMovie ? 'Filme' : 'Série',
        }
      );

      return {
        ...item,
        popularity: entry.popularity ?? 0,
        trendingWindow: timeWindow,
      };
    })
    .filter(Boolean);
}
