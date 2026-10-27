
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  'https://vortex-stream-u8wz.onrender.com'
).replace(/\/+$/, '');

const TOP_TEN_CACHE_KEY = 'vortex_top_ten_v1';
const TOP_TEN_CACHE_TTL = 60 * 60 * 1000; // 1 hora

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

function extractItems(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.results?.items)) return data.results.items;
  return [];
}

/**
 * Retorna o Top 10 salvo localmente, se existir.
 * O cache pode ser usado imediatamente enquanto a API atualiza os dados.
 */
export function getCachedTopTen() {
  try {
    const raw = localStorage.getItem(TOP_TEN_CACHE_KEY);
    if (!raw) return null;

    const cached = JSON.parse(raw);

    if (!Array.isArray(cached.items)) return null;

    return cached.items;
  } catch (error) {
    console.warn('[VORTEX] Não foi possível ler o cache do Top 10:', error);
    return null;
  }
}

function saveCachedTopTen(items) {
  try {
    localStorage.setItem(
      TOP_TEN_CACHE_KEY,
      JSON.stringify({
        items,
        updatedAt: Date.now(),
      })
    );
  } catch (error) {
    console.warn('[VORTEX] Não foi possível salvar o cache:', error);
  }
}

function isTopTenCacheFresh() {
  try {
    const raw = localStorage.getItem(TOP_TEN_CACHE_KEY);
    if (!raw) return false;

    const cached = JSON.parse(raw);

    return (
      Array.isArray(cached.items) &&
      cached.items.length > 0 &&
      Number.isFinite(cached.updatedAt) &&
      Date.now() - cached.updatedAt < TOP_TEN_CACHE_TTL
    );
  } catch {
    return false;
  }
}

export async function fetchCatalog() {
  try {
    const data = await request('/api/catalog?limit=100');
    return extractItems(data);
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
    return extractItems(data);
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

/**
 * Busca títulos em alta.
 * A rota /api/trending precisa existir no backend para fornecer
 * tendências reais; o catálogo é apenas uma alternativa de contingência.
 */
export async function fetchTopTen({ forceRefresh = false } = {}) {
  if (!forceRefresh && isTopTenCacheFresh()) {
    const cached = getCachedTopTen();
    if (cached?.length) return cached.slice(0, 10);
  }

  try {
    const data = await request('/api/trending?window=day&limit=40');
    const trending = extractItems(data);

    if (trending.length > 0) {
      const topTen = trending.slice(0, 10);
      saveCachedTopTen(topTen);
      return topTen;
    }
  } catch (error) {
    console.warn(
      '[VORTEX] Tendências indisponíveis; tentando o catálogo:',
      error
    );
  }

  // Mantém a aplicação utilizável se a rota de tendências falhar.
  const cached = getCachedTopTen();
  if (cached?.length) return cached.slice(0, 10);

  const catalog = await fetchCatalog();

  if (catalog?.length) {
    const fallback = catalog.slice(0, 10);
    saveCachedTopTen(fallback);
    return fallback;
  }

  return null;
}

export async function sendPlaybackEvent() {
  return;
}
