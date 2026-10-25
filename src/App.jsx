
import React, { useEffect, useMemo, useState } from 'react';
import { Search, Play, Plus, Info, ChevronRight, ChevronLeft, X, Check, Menu, UserRound, ArrowLeft, Home } from 'lucide-react';
import { catalog as demoCatalog } from './data/catalog';
import { fetchCatalog, fetchTopTen, fetchPlayback, fetchSearch } from './services/api';
import { readHistory, saveProgress } from './services/watchHistory';

// ANIMAÇÃO DE CARREGAMENTO PERFEITA - FICA AQUI! (linha 8 a 30)
function PerfectLoader(){
  return (
    <div className="perfect-loader">
      <div className="vortex-orbit">
        <div className="orbit orbit-1"></div>
        <div className="orbit orbit-2"></div>
        <div className="orbit orbit-3"></div>
        <div className="v-core"><img src="/logo-v.png" alt="V" /></div>
      </div>
      <div className="loader-text"><span>V</span><span>O</span><span>R</span><span>T</span><span>E</span><span>X</span></div>
      <div className="skeleton-grid">{Array.from({length:12}).map((_,i)=><div key={i} className="skeleton-card"><div className="skeleton-shimmer"></div></div>)}</div>
    </div>
  )
}

function PlayerModal({ item, playback, season, setSeason, episode, setEpisode, onClose }){
  const [url, setUrl] = useState('');
  useEffect(()=>{
    if(!playback) return;
    if(playback.type==='serie') setUrl(playback.buildUrl ? playback.buildUrl(season, episode, '#noEpList') : `${playback.playerUrl}/${season}/${episode}#noEpList`);
    else setUrl(playback.playerUrlNoList || playback.playerUrl);
  }, [season, episode, playback]);
  if(!playback || !url) return null;
  return (
    <div className="player-overlay" onClick={(e)=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="player-modal glass-modal">
        <div className="player-header">
          <div className="player-title"><strong>{item.title}</strong> <span>{item.year} • {item.genre}</span></div>
          <button className="icon-button" onClick={onClose}><X size={18}/></button>
        </div>
        <div className="player-frame">
          <iframe src={url} width="100%" height="100%" frameBorder="0" allowFullScreen allow="autoplay; encrypted-media; fullscreen" title={item.title}></iframe>
        </div>
        {playback.type==='serie' && (
          <div className="player-controls">
            <label>Temporada <select value={season} onChange={e=>setSeason(Number(e.target.value))}>{[1,2,3,4,5,6,7,8,9,10].map(n=><option key={n} value={n}>{n}</option>)}</select></label>
            <label>Episódio <select value={episode} onChange={e=>setEpisode(Number(e.target.value))}>{Array.from({length:40},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App(){
  const [items,setItems]=useState(demoCatalog);
  const [history,setHistory]=useState(readHistory());
  const [selected,setSelected]=useState(null);
  const [search,setSearch]=useState('');
  const [searchOpen,setSearchOpen]=useState(false);
  const [activeNav,setActiveNav]=useState('Início');
  const [season,setSeason]=useState(1);
  const [loading,setLoading]=useState(true);
  const [playing,setPlaying]=useState(null);
  const [playback,setPlayback]=useState(null);
  const [pSeason,setPSeason]=useState(1);
  const [pEpisode,setPEpisode]=useState(1);
  const [notice,setNotice]=useState('');

  useEffect(()=>{
    setLoading(true);
    fetchCatalog().then(data=>{
      if(data?.length) setItems(data);
      setLoading(false);
    }).catch(()=>setLoading(false));
  }, []);

  const hero = items.find(x=>x.featured) || items[0] || demoCatalog[0];
  const byId = id=>items.find(x=>x.id===id);
  const continueItems = history.map(h=>{ const it=byId(h.id); return it?{...it, progress:h.progress}:null }).filter(Boolean);
  const topTen = useMemo(()=>{ const ev=JSON.parse(localStorage.getItem('vortex.events.v1')||'{}'); return [...items].sort((a,b)=> (ev[b.id]?.length||0)-(ev[a.id]?.length||0)).slice(0,10); },[items]);
  const filtered = items.filter(x=>x.title.toLowerCase().includes(search.toLowerCase()));
  const visibleItems = activeNav==='Filmes' ? items.filter(x=>x.type==='movie') : activeNav==='Séries' ? items.filter(x=>x.type==='series') : items;

  async function play(item, extra={}){
    saveProgress(item, Math.min(94,(history.find(h=>h.id===item.id)?.progress||0)+12));
    setHistory(readHistory());
    try{
      const pb = await fetchPlayback(item.id);
      setPlaying(item); setPlayback(pb); setPSeason(extra.season||season||1); setPEpisode(extra.episode?.number||extra.episode||1);
    }catch{ setNotice('Não foi possível reproduzir'); setTimeout(()=>setNotice(''),2500); }
  }
  async function doSearch(e){
    e?.preventDefault();
    if(!search.trim()){ const data=await fetchCatalog(); if(data?.length) setItems(data); return; }
    setLoading(true);
    const data=await fetchSearch(search);
    if(data?.length) setItems(data);
    setLoading(false);
  }
  function openDetails(item){ setSelected(item); setSeason(1); window.scrollTo(0,0); }
  function goHome(){ setSelected(null); setSearch(''); setActiveNav('Início'); window.scrollTo(0,0); fetchCatalog().then(d=>{ if(d?.length) setItems(d); }); }

  // TELA DE DETALHES - COM SETA SEMPRE VOLTANDO PRA HOME
  if(selected){
    const backdrop = selected.backdrop && !selected.backdrop.includes('logo-v') && !selected.backdrop.includes('via.placeholder') ? selected.backdrop : selected.poster;
    const safeBackdrop = backdrop && backdrop.startsWith('http') ? backdrop : 'https://image.tmdb.org/t/p/w1280/8Gxv8gSFCUxvHy5T4k7qDkF7K4w.jpg';
    return (
      <div className="details-page">
        <div className="glass-topbar detail-bar">
          <button className="back-button" onClick={goHome}><ArrowLeft size={18}/> Voltar ao início</button>
          <div className="topbar-logo"><img src="/logo-v.png" alt="V"/> VORTEX</div>
          <button className="back-button" onClick={goHome}><Home size={18}/></button>
        </div>
        <section className="details-hero" style={{'--hero-image':`url("${safeBackdrop}")`}}><div className="details-shade"/><div className="details-info">
          <p className="eyebrow">{selected.type==='series'?'SÉRIE':'FILME'} / {selected.genre?.toUpperCase()}</p><h1>{selected.title}</h1>
          <div className="hero-meta"><span>{selected.year}</span><span className="rating-chip">{selected.rating}</span><span>{selected.genre}</span></div>
          <p className="details-synopsis">{selected.synopsis}</p>
          <div className="hero-buttons"><button className="primary-button" onClick={()=>play(selected)}><Play size={18} fill="currentColor"/> Assistir agora</button><button className="secondary-button" onClick={goHome}><ArrowLeft size={18}/> Voltar</button></div>
        </div></section>
        {selected.type==='series' && <section className="episodes-section"><div className="section-heading"><div><h2>Episódios</h2><p>Escolha a temporada</p></div><select value={season} onChange={e=>setSeason(Number(e.target.value))}>{(selected.seasons||[]).map(s=><option key={s.number} value={s.number}>Temporada {s.number}</option>)}</select></div>
          <div className="episode-list">{(selected.seasons?.find(s=>s.number===season)?.episodes||[]).map(ep=><article className="episode" key={ep.number}><div className="episode-number">{String(ep.number).padStart(2,'0')}</div><div className="episode-art" style={{backgroundImage:`url("${safeBackdrop}")`}}><Play size={18} fill="currentColor"/></div><div className="episode-copy"><h3>{ep.title}</h3><p>Ep {ep.number}</p></div><button className="icon-button episode-play" onClick={()=>play(selected,{episode:ep, season})}><Play size={18}/></button></article>)}</div></section>}
        {playing && playback && <PlayerModal item={playing} playback={playback} season={pSeason} setSeason={setPSeason} episode={pEpisode} setEpisode={setPEpisode} onClose={()=>{setPlaying(null); setPlayback(null);}} />}
      </div>
    )
  }

  return (
    <div className="app-shell">
      {/* TOP BAR GLASS CENTRAL */}
      <div className="glass-topbar">
        <button className="wordmark" onClick={goHome}>VORTEX<span>.</span></button>
        <nav className="glass-nav">{['Início','Filmes','Séries'].map(n=><button key={n} className={activeNav===n?'active':''} onClick={()=>{setActiveNav(n); if(n==='Início') goHome();}}>{n}</button>)}</nav>
        <div className="glass-actions">
          {searchOpen ? <form onSubmit={doSearch} className="glass-search"><input autoFocus placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)} /><button type="submit"><Search size={16}/></button></form> : <button className="icon-button" onClick={()=>setSearchOpen(true)}><Search size={18}/></button>}
          <button className="icon-button" onClick={goHome}><Home size={16}/></button>
        </div>
      </div>

      {loading ? <PerfectLoader /> : (
        <main>
          {search ? <section className="search-results"><p className="eyebrow">RESULTADOS</p><h2>{filtered.length} resultados para "{search}"</h2><div className="card-grid">{filtered.map(item=><article className="grid-card" key={item.id}><button className="poster-image" style={{backgroundImage:`url("${item.poster}")`}} onClick={()=>openDetails(item)}><span className="poster-hover"><span className="mini-play"><Play size={14}/></span>{item.title}</span></button><div className="poster-caption"><button onClick={()=>openDetails(item)}>{item.title}</button><button className="tiny-play" onClick={()=>play(item)}><Play size={12}/></button></div></article>)}</div></section> :
          <>
            {activeNav!=='Início' ? <section className="category-page">
              <div className="category-heading"><p className="eyebrow">EXPLORE O CATÁLOGO</p><h1>{activeNav}</h1><p>Descubra sua próxima história favorita.</p></div>
              <div className="card-grid">{visibleItems.map(item=><article className="grid-card" key={item.id}><button className="poster-image" style={{backgroundImage:`url("${item.poster}")`}} onClick={()=>openDetails(item)}><span className="poster-hover"><span className="mini-play"><Play size={14}/></span>{item.title}</span></button><div className="poster-caption"><button onClick={()=>openDetails(item)}>{item.title}</button><button className="tiny-play" onClick={()=>play(item)}><Play size={12}/></button></div></article>)}</div>
            </section> : <>
            <section className="hero" style={{'--hero-image':`url("${(hero.backdrop && hero.backdrop.startsWith('http') ? hero.backdrop : hero.poster)}")`}}>
              <div className="hero-shade"></div>
              <div className="hero-content">
                <div className="hero-kicker"><span className="kicker-line"></span> VORTEX ORIGINALS</div>
                <h1>{hero.title}</h1>
                <div className="hero-meta"><span>{hero.year}</span><span className="rating-chip">{hero.rating}</span><span>{hero.genre}</span></div>
                <p className="hero-description">{hero.synopsis?.slice(0,200)}</p>
                <div className="hero-buttons"><button className="primary-button" onClick={()=>play(hero)}><Play size={18} fill="currentColor"/> Assistir agora</button><button className="secondary-button" onClick={()=>openDetails(hero)}><Info size={18}/> Detalhes</button></div>
              </div>
            </section>
            <div className="home-content">
              {continueItems.length>0 && <ContentRow title="Continuar Assistindo" items={continueItems} onDetails={openDetails} onPlay={play} progress/>}
              <ContentRow title="Top 10 no VORTEX" items={topTen} onDetails={openDetails} onPlay={play} ranked/>
              <ContentRow title="Filmes" items={items.filter(x=>x.type==='movie').slice(0,18)} onDetails={openDetails} onPlay={play}/>
              <ContentRow title="Séries" items={items.filter(x=>x.type==='series').slice(0,18)} onDetails={openDetails} onPlay={play}/>
            </div>
            </>}
          </>
          }
        </main>
      )}
      <footer><span className="footer-logo">VORTEX<span>.</span></span><span>Histórias que ficam com você</span><span>© 2026</span></footer>
      {notice && <div className="toast"><Check size={14}/>{notice}</div>}
      {playing && playback && <PlayerModal item={playing} playback={playback} season={pSeason} setSeason={setPSeason} episode={pEpisode} setEpisode={setPEpisode} onClose={()=>{setPlaying(null); setPlayback(null);}} />}
    </div>
  )
}

function ContentRow({title,items,onDetails,onPlay,ranked,progress}){
  const [off,setOff]=useState(0);
  if(!items?.length) return null;
  return <section className="content-section"><div className="section-heading"><div><h2>{title}</h2></div><div className="row-controls"><button className="row-arrow" onClick={()=>setOff(Math.max(0,off-1))}><ChevronLeft size={16}/></button><button className="row-arrow" onClick={()=>setOff(Math.min(Math.max(0,items.length-4),off+1))}><ChevronRight size={16}/></button></div></div>
  <div className="poster-track">{items.slice(off,off+6).map((item,i)=>{
    const poster = item.poster && item.poster.startsWith('http') ? item.poster : 'https://via.placeholder.com/400x600/10182f/8dbdff?text=VORTEX';
    return <article className={`poster-card ${ranked?'ranked-card':''}`} key={item.id}>{ranked&&<div className="rank-number">{String(off+i+1).padStart(2,'0')}</div>}<button className="poster-image" style={{backgroundImage:`url("${poster}")`}} onClick={()=>onDetails(item)}><span className="poster-hover"><span className="mini-play"><Play size={13}/></span><span className="poster-hover-title">{item.title}</span></span>{progress&&<span className="progress-track"><i style={{width:`${item.progress||12}%`}}/></span>}</button><div className="poster-caption"><button onClick={()=>onDetails(item)}>{item.title}</button><button className="tiny-play" onClick={()=>onPlay(item)}><Play size={12}/></button></div></article>
  })}</div></section>;
}
