
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

export async function fetchTopTen() {
  try {
    const catalog = await fetchCatalog();
    return catalog === null ? null : catalog.slice(0, 10);
  } catch (error) {
    console.error('[VORTEX] Falha ao carregar Top 10:', error);
    return null;
  }
}

export async function sendPlaybackEvent() {
  return;
}
