export async function fetchCatalog(){
  try{
    const res = await fetch('/api/catalog?limit=100');
    if(!res.ok) throw new Error('API fail');
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
  }catch(e){
    console.warn('[VORTEX] fetchCatalog falhou, usando fallback', e.message);
    return null;
  }
}
export async function fetchSearch(q){
  try{
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.items || []);
  }catch{ return []; }
}
export async function fetchPlayback(id){
  const res = await fetch(`/api/playback/${encodeURIComponent(id)}`);
  if(!res.ok) throw new Error('Playback fail');
  return res.json();
}
export async function fetchTopTen(){
  try{
    const data = await fetchCatalog();
    if(!data) return null;
    return data.slice(0,10);
  }catch{ return null; }
}
export async function sendPlaybackEvent(){ return; }