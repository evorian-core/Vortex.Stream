
const SUPERFLIX_BASE = (process.env.SUPERFLIX_BASE_URL || 'https://superflixapi.fun').replace(/\/+$/, '');
const TMDB_KEY = process.env.TMDB_API_KEY || '3aec63790d50f3b9fc2efb4c15a8cf99';
const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w500';
async function fetchJSON(url, timeoutMs=12000){
  const ctrl=new AbortController(); const t=setTimeout(()=>ctrl.abort(), timeoutMs);
  try{ const res=await fetch(url,{headers:{'User-Agent':'VORTEX/4.0'}}); if(!res.ok) throw new Error(`HTTP ${res.status}`); return await res.json(); }finally{clearTimeout(t);}
}
function normalizeId(item){ if(typeof item==='string'||typeof item==='number') return String(item).trim(); if(!item) return ''; return String(item.id||item.tmdb_id||item.imdb_id||'').trim(); }
async function enrichWithTMDB(tmdbId, isMovie=true){
  if(!tmdbId || tmdbId.startsWith('tt') || isNaN(Number(tmdbId))) return null;
  try{ const type=isMovie?'movie':'tv'; const url=`${TMDB_BASE}/${type}/${tmdbId}?api_key=${TMDB_KEY}&language=pt-BR`; const data=await fetchJSON(url); return { title:data.title||data.name, originalTitle:data.original_title||data.original_name, synopsis:data.overview||'Sem sinopse.', year:(data.release_date||data.first_air_date||'').slice(0,4)||2024, poster:data.poster_path?`${TMDB_IMAGE}${data.poster_path}`:null, backdrop:data.backdrop_path?`https://image.tmdb.org/t/p/w1280${data.backdrop_path}`:null, rating:data.vote_average?String(Math.round(data.vote_average*10)/10):'14', genre:data.genres?.[0]?.name||(isMovie?'Filme':'Série') }; }catch{ return null; }
}
function toVortexItem(rawId, category, tmdbInfo=null){
  const id=normalizeId(rawId); if(!id) return null; const isMovie=['filme','movie','filmes'].includes(category);
  const titleFinal=tmdbInfo?.title||`${category} ${id}`;
  return { id:`${category}-${id}`, providerId:id, providerCategory:category, title:titleFinal, originalTitle:tmdbInfo?.originalTitle||id, type:isMovie?'movie':'series', year:tmdbInfo?.year||2024, rating:tmdbInfo?.rating||'14', duration:isMovie?'1h 50min':undefined, genre:tmdbInfo?.genre||category, synopsis:tmdbInfo?.synopsis||`ID ${id} via SuperFlix`, director:'SuperFlix', cast:[], poster:tmdbInfo?.poster||`https://via.placeholder.com/400x600/0e1428/8dbdff?text=${encodeURIComponent(titleFinal.slice(0,20))}`, backdrop:tmdbInfo?.backdrop||tmdbInfo?.poster||`https://via.placeholder.com/1200x600/08090d/8dbdff?text=${encodeURIComponent(titleFinal.slice(0,20))}`, featured:false, seasons:!isMovie?[{number:1, episodes:Array.from({length:24},(_,i)=>({number:i+1, title:`Episódio ${i+1}`, duration:'45 min'}))}]:undefined };
}
async function listByCategory(category, limit=60){
  const url=new URL(`${SUPERFLIX_BASE}/lista`); url.searchParams.set('category', category); url.searchParams.set('format','json'); url.searchParams.set('type','tmdb'); url.searchParams.set('limit', String(limit));
  try{ const data=await fetchJSON(url.toString()); return Array.isArray(data)?data:(data.items||data.results||data.data||[]); }catch(e){ console.warn(category, e.message); return []; }
}
export async function getProviderCatalog(opts={}){
  const limit = opts.limit || 100;
  const [filmes, series, animes, doramas] = await Promise.all([ listByCategory('filme', limit), listByCategory('serie', limit), listByCategory('anime', 40), listByCategory('dorama', 40) ]);
  const limited = [
    ...filmes.slice(0, Math.floor(limit*0.4)).map(id=>({id, cat:'filme', isMovie:true})),
    ...series.slice(0, Math.floor(limit*0.3)).map(id=>({id, cat:'serie', isMovie:false})),
    ...animes.slice(0, Math.floor(limit*0.15)).map(id=>({id, cat:'anime', isMovie:false})),
    ...doramas.slice(0, Math.floor(limit*0.15)).map(id=>({id, cat:'dorama', isMovie:false})),
  ];
  const enriched = await Promise.all(limited.map(async ({id, cat, isMovie})=>{
    const rawId=normalizeId(id); const info=await enrichWithTMDB(rawId, isMovie); return toVortexItem(rawId, cat, info);
  }));
  const items=enriched.filter(Boolean); if(items.length) items[0].featured=true; return items;
}
// BUSCA INFINITA: busca no SuperFlix E no TMDB direto
export async function searchProvider(q){
  if(!q) return [];
  const results = [];
  // 1) SuperFlix
  try{
    const url=new URL(`${SUPERFLIX_BASE}/lista`); url.searchParams.set('category','pesquisa'); url.searchParams.set('q', q); url.searchParams.set('format','json'); url.searchParams.set('limit','30');
    const data=await fetchJSON(url.toString()); const arr=Array.isArray(data)?data:(data.items||[]);
    const enriched = await Promise.all(arr.slice(0,10).map(async r=>{ const raw=normalizeId(r); const info=await enrichWithTMDB(raw, true); return toVortexItem(raw, 'filme', info); }));
    results.push(...enriched.filter(Boolean));
  }catch{}
  // 2) TMDB SEARCH direto - resolve o problema de filmes que não aparecem
  try{
    const movieUrl=`${TMDB_BASE}/search/movie?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(q)}`;
    const tvUrl=`${TMDB_BASE}/search/tv?api_key=${TMDB_KEY}&language=pt-BR&query=${encodeURIComponent(q)}`;
    const [movieData, tvData] = await Promise.all([ fetchJSON(movieUrl).catch(()=>({results:[]})), fetchJSON(tvUrl).catch(()=>({results:[]})) ]);
    const movies = (movieData.results||[]).slice(0,12).map(m=> toVortexItem(String(m.id), 'filme', { title:m.title||m.name, originalTitle:m.original_title, synopsis:m.overview, year:(m.release_date||'').slice(0,4), poster:m.poster_path?`${TMDB_IMAGE}${m.poster_path}`:null, backdrop:m.backdrop_path?`https://image.tmdb.org/t/p/w1280${m.backdrop_path}`:null, rating:m.vote_average?String(m.vote_average.toFixed(1)):'14', genre:'Filme' }));
    const series = (tvData.results||[]).slice(0,8).map(m=> toVortexItem(String(m.id), 'serie', { title:m.name, originalTitle:m.original_name, synopsis:m.overview, year:(m.first_air_date||'').slice(0,4), poster:m.poster_path?`${TMDB_IMAGE}${m.poster_path}`:null, backdrop:m.backdrop_path?`https://image.tmdb.org/t/p/w1280${m.backdrop_path}`:null, rating:m.vote_average?String(m.vote_average.toFixed(1)):'14', genre:'Série' }));
    results.push(...movies, ...series);
  }catch(e){ console.warn('TMDB search fail', e.message); }
  // deduplica por providerId
  const seen=new Set(); const dedup=[]; for(const r of results){ if(!r) continue; if(seen.has(r.providerId)) continue; seen.add(r.providerId); dedup.push(r); }
  return dedup;
}
export async function getPlayback(contentId){
  let raw=contentId; if(contentId.includes('-')){ const m=contentId.match(/tt\d+/); if(m) raw=m[0]; else raw=contentId.split('-').slice(1).join('-'); }
  const isMovie=contentId.startsWith('filme-')||/tt\d+/.test(raw)||contentId.includes('filme'); const type=isMovie?'filme':'serie'; const basePlayer=`${SUPERFLIX_BASE}/${type}/${raw}`;
  return { id:contentId, providerId:raw, type, playerUrl:basePlayer, playerUrlNoList:`${basePlayer}#noEpList`, playerUrlCustom:`${basePlayer}#noEpList#color:8dbdff#transparent`, buildUrl:(season=1, episode=1, hashes='#noEpList')=>{ if(type==='filme') return `${basePlayer}${hashes||''}`; return `${SUPERFLIX_BASE}/serie/${raw}/${season}/${episode}${hashes||''}`; } };
}
export async function getChannels(q=''){ return listByCategory('canais', 40); }
export async function getEvents(sport=''){ const url=new URL(`${SUPERFLIX_BASE}/lista`); url.searchParams.set('category','eventos'); url.searchParams.set('format','json'); if(sport) url.searchParams.set('sport', sport); try{ return await fetchJSON(url.toString()); }catch{ return []; } }
