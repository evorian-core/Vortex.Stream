import { useState, useEffect, useMemo } from 'react';
import { Search, Play, Plus, Info, ChevronRight, ChevronLeft, X, Check, UserRound, ArrowLeft, Home, Clapperboard, Tv, Compass, Settings, Sparkles, Film, CircleUserRound, SlidersHorizontal } from 'lucide-react';
import { catalog as demoCatalog } from './data/catalog';
import { fetchCatalog, fetchPlayback, fetchSearch, fetchTopTen, getCachedTopTen } from './services/api';
import { readHistory, saveProgress } from './services/watchHistory';
import SettingsPanel from './components/SettingsPanel';
import AuthScreen from './components/AuthScreen';
import { authService } from './services/auth';

const AVATARS = [
  { id: 'vortex', name: 'VORTEX', kind: 'Marca', tone: 'violet' },
  { id: 'nova', name: 'Nova', kind: 'Avatar', tone: 'nova' },
  { id: 'onyx', name: 'Onyx', kind: 'Avatar', tone: 'onyx' },
  { id: 'sol', name: 'Sol', kind: 'Avatar', tone: 'sol' },
  { id: 'luna', name: 'Luna', kind: 'Avatar', tone: 'luna' },
  { id: 'ember', name: 'Ember', kind: 'Avatar', tone: 'ember' },
  { id: 'echo', name: 'Echo', kind: 'Avatar', tone: 'echo' },
  { id: 'atlas', name: 'Atlas', kind: 'Avatar', tone: 'atlas' },
];
// A API atual fornece pôsteres de títulos, não retratos de personagens.
// Não usamos capas de filmes como se fossem fotos de perfil.
const buildAvatars = () => AVATARS;
const PROFILE_KEY = 'vortex.profiles.v1';
const defaultProfiles = [{ id: 'main', name: 'Meu perfil', avatar: 'vortex', kids: false }];
const readProfiles = () => { try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) || 'null'); return Array.isArray(p) && p.length ? p : defaultProfiles; } catch { return defaultProfiles; } };
const img = (value, fallback = '') => typeof value === 'string' && value.startsWith('http') ? value : fallback;
const getCast = item => {
  const raw = item?.cast || item?.actors || item?.credits?.cast || item?.credits?.actors || [];
  if (Array.isArray(raw)) return raw.map((person, i) => typeof person === 'string' ? { id: `${person}-${i}`, name: person, character: '' } : ({ id: person.id || `${person.name}-${i}`, name: person.name || person.original_name || 'Artista', character: person.character || person.role || '' })).filter(p => p.name);
  if (typeof raw === 'string') return raw.split(',').map((name, i) => ({ id: `${name}-${i}`, name: name.trim(), character: '' })).filter(p => p.name);
  return [];
};
const getSeasons = item => {
  const raw = item?.seasons || item?.episodes_by_season || item?.number_of_seasons_data || [];
  if (Array.isArray(raw) && raw.length) return raw.map((s, i) => ({ number: Number(s.number ?? s.season_number ?? i + 1), episodes: Array.isArray(s.episodes) ? s.episodes : [] })).filter(s => s.number > 0).sort((a,b)=>a.number-b.number);
  const episodes = Array.isArray(item?.episodes) ? item.episodes : [];
  if (episodes.length) {
    const groups = new Map();
    episodes.forEach((ep, i) => { const number = Number(ep.season_number ?? ep.season ?? 1); if (!groups.has(number)) groups.set(number, []); groups.get(number).push({ ...ep, number: Number(ep.episode_number ?? ep.number ?? i + 1), title: ep.name || ep.title || `Episódio ${ep.episode_number ?? ep.number ?? i + 1}` }); });
    return [...groups.entries()].map(([number, episodes])=>({number, episodes})).sort((a,b)=>a.number-b.number);
  }
  return [];
};

function PerfectLoader(){ return <div className="loading-screen"><div className="loader-mark"><span>V</span></div><div className="loader-word">VORTEX</div><p>Preparando sua próxima história</p><div className="loading-line"><i/></div></div>; }

function CastSection({ item }) {
  const cast = getCast(item);
  return <section className="cast-section"><div className="section-title"><div><span className="section-kicker">POR TRÁS DA HISTÓRIA</span><h2>Elenco</h2></div><span className="section-count">{cast.length ? `${cast.length} nomes` : 'Informações do elenco'}</span></div>
    {cast.length ? <div className="cast-track">{cast.map(person => <article className="cast-card" key={person.id}><div className="cast-avatar"><CircleUserRound size={27}/></div><div><strong>{person.name}</strong><span>{person.character || 'Elenco'}</span></div></article>)}</div> : <p className="muted-note">O elenco ainda não está disponível para este título.</p>}
  </section>;
}

function PlayerModal({ item, playback, season, setSeason, episode, setEpisode, onClose }){
  const [url, setUrl] = useState('');
  const seasons = getSeasons(item);
  useEffect(()=>{ if(!playback) return; if(playback.type==='serie' || item.type==='series') setUrl(playback.buildUrl ? playback.buildUrl(season, episode, '#noEpList') : `${playback.playerUrl}/${season}/${episode}#noEpList`); else setUrl(playback.playerUrlNoList || playback.playerUrl || ''); }, [season, episode, playback, item.type]);
  if(!playback || !url) return null;
  return <div className="player-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}}><div className="player-modal"><div className="player-header"><div><span className="section-kicker">VORTEX PLAYER</span><h3>{item.title}</h3></div><button className="icon-button" onClick={onClose} aria-label="Fechar player"><X/></button></div><div className="player-frame"><iframe src={url} title={item.title} width="100%" height="100%" frameBorder="0" allowFullScreen allow="autoplay; encrypted-media; fullscreen"/></div>{(playback.type==='serie'||item.type==='series')&&<div className="player-controls"><label>Temporada <select value={season} onChange={e=>setSeason(Number(e.target.value))}>{(seasons.length?seasons:Array.from({length:10},(_,i)=>({number:i+1}))).map(s=><option key={s.number} value={s.number}>{s.number}</option>)}</select></label><label>Episódio <select value={episode} onChange={e=>setEpisode(Number(e.target.value))}>{Array.from({length:40},(_,i)=><option key={i+1} value={i+1}>{i+1}</option>)}</select></label></div>}</div></div>;
}

function ProfilesScreen({ profiles, onChoose, onUpdate, items, account, onSignOut }) {
  const avatars = buildAvatars(items);
  const [editing, setEditing] = useState(false); const [name, setName] = useState(''); const [avatar, setAvatar] = useState('vortex'); const [kids, setKids] = useState(false);
  function createProfile(e){ e.preventDefault(); if(!name.trim()) return; const next=[...profiles,{id:`profile-${Date.now()}`,name:name.trim(),avatar,kids}]; onUpdate(next); setName('');setAvatar('vortex');setKids(false);setEditing(false); }
  return <main className="profiles-screen"><div className="profiles-brand"><span className="brand-symbol">V</span><span>VORTEX</span></div><div className="profiles-main"><span className="section-kicker">SEU UNIVERSO, SUAS REGRAS</span><h1>Quem está assistindo?</h1><p>Escolha um perfil para continuar de onde parou.</p><div className="profile-grid">{profiles.map(profile=>{const av=avatars.find(a=>a.id===profile.avatar)||AVATARS[0];return <button className="profile-tile" key={profile.id} onClick={()=>onChoose(profile)}><span className={`profile-avatar avatar-${av.tone||'violet'}`} aria-hidden="true">{av.id==='vortex'?<img src="/logo-v.png" alt=""/>:<span className="avatar-monogram">{av.name.slice(0,1)}</span>}<span className="avatar-badge">{profile.kids?'KIDS':'V'}</span></span><strong>{profile.name}</strong></button>;})}<button className="profile-tile add-profile" onClick={()=>setEditing(v=>!v)}><span className="add-avatar"><Plus size={36}/></span><strong>Adicionar perfil</strong></button></div>
  {editing&&<form className="profile-editor" onSubmit={createProfile}><div className="editor-heading"><h2>Novo perfil</h2><button type="button" className="icon-button" onClick={()=>setEditing(false)}><X/></button></div><label>Nome do perfil<input value={name} onChange={e=>setName(e.target.value)} maxLength={24} placeholder="Como vamos chamar?" required/></label><span className="field-label">Escolha seu avatar</span><div className="avatar-choices">{avatars.map(a=><button type="button" key={a.id} className={`avatar-choice ${avatar===a.id?'chosen':''}`} onClick={()=>setAvatar(a.id)} title={a.name}><span className={`avatar-choice-art avatar-${a.tone||'violet'}`}>{a.id==='vortex'?<img src="/logo-v.png" alt=""/>:<span>{a.name.slice(0,1)}</span>}</span><span>{a.name}</span></button>)}</div><label className="kids-check"><input type="checkbox" checked={kids} onChange={e=>setKids(e.target.checked)}/> Perfil infantil</label><button className="primary-button" type="submit"><Check size={17}/> Criar perfil</button></form>}
  </div><div className="profiles-account"><span>{account?.email || 'Conta VORTEX'}</span><button type="button" onClick={onSignOut}>Sair da conta</button></div><p className="profiles-foot">Perfis separados. Uma experiência só sua.</p></main>;
}

export default function App(){
  const [items,setItems]=useState(demoCatalog); const [topTen,setTopTen]=useState(()=>getCachedTopTen() || demoCatalog.slice(0,10)); const [history,setHistory]=useState(readHistory()); const [selected,setSelected]=useState(null); const [search,setSearch]=useState(''); const [searchOpen,setSearchOpen]=useState(false); const [activeNav,setActiveNav]=useState('Início'); const [season,setSeason]=useState(1); const [loading,setLoading]=useState(true); const [playing,setPlaying]=useState(null); const [playback,setPlayback]=useState(null); const [pSeason,setPSeason]=useState(1); const [pEpisode,setPEpisode]=useState(1); const [notice,setNotice]=useState(''); const [profiles,setProfiles]=useState(readProfiles); const [profile,setProfile]=useState(null); const [showProfiles,setShowProfiles]=useState(true); const [mobileMenu,setMobileMenu]=useState(false); const [showSettings,setShowSettings]=useState(false); const [heroIndex,setHeroIndex]=useState(0); const [authStatus,setAuthStatus]=useState('checking'); const [account,setAccount]=useState(null);
  useEffect(()=>{
    let alive=true;
    authService.getSession().then(session=>{
      if(!alive) return;
      if(session?.user){
        setAccount(session.user);
        const saved=readProfiles();
        const next=saved.length && saved[0].name!=='Meu perfil' ? saved : [{id:'main',name:session.user.name||'Meu perfil',avatar:'vortex',kids:false}];
        setProfiles(next);
        setAuthStatus('authenticated');
      } else setAuthStatus('unauthenticated');
    }).catch(error=>{
      console.warn('[VORTEX] Não foi possível validar a sessão:', error.message);
      if(alive) setAuthStatus('unauthenticated');
    });
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{
    let alive=true;
    // Mostra o último ranking salvo sem esperar pela rede.
    const cachedTopTen=getCachedTopTen();
    if(cachedTopTen?.length) setTopTen(cachedTopTen);
    (async()=>{
      try {
        // Uma única consulta ao catálogo por abertura; o ranking usa a mesma resposta.
        const catalog=await fetchCatalog();
        if(!alive) return;
        if(catalog?.length) {
          setItems(catalog);
          const trending=await fetchTopTen(catalog);
          if(alive && trending?.length) setTopTen(trending);
        } else {
          const trending=await fetchTopTen();
          if(alive && trending?.length) setTopTen(trending);
        }
      } catch(error) {
        console.error('[VORTEX] Falha ao inicializar catálogo e Top 10:', error);
        const trending=await fetchTopTen();
        if(alive && trending?.length) setTopTen(trending);
      } finally {
        if(alive) setLoading(false);
      }
    })();
    return ()=>{alive=false;};
  },[]);
  useEffect(()=>{localStorage.setItem(PROFILE_KEY,JSON.stringify(profiles));},[profiles]);
  const heroCandidates=useMemo(()=>{const combined=[...topTen,...items.filter(x=>img(x.backdrop)||img(x.poster))];const seen=new Set();return combined.filter(item=>{const key=String(item?.id??item?.title??'');if(!key||seen.has(key))return false;seen.add(key);return Boolean(img(item.backdrop)||img(item.poster));}).sort((a,b)=>Number(Boolean(img(b.backdrop)))-Number(Boolean(img(a.backdrop)))).slice(0,10);},[topTen,items]);
  const hero=heroCandidates.length?heroCandidates[heroIndex%heroCandidates.length]:(items.find(x=>x.featured)||items[0]||demoCatalog[0]);
  useEffect(()=>{if(heroCandidates.length<2)return;const timer=window.setInterval(()=>setHeroIndex(index=>(index+1)%heroCandidates.length),8000);return()=>window.clearInterval(timer);},[heroCandidates.length]);
  useEffect(()=>{if(heroIndex>=heroCandidates.length)setHeroIndex(0);},[heroIndex,heroCandidates.length]);
  const continueItems=history.map(h=>{const it=items.find(x=>String(x.id)===String(h.id));return it?{...it,progress:h.progress}:null;}).filter(Boolean);
  // topTen é atualizado pela API ao abrir a aplicação, com cache local como fallback.

  const filtered=items.filter(x=>(x.title||'').toLowerCase().includes(search.toLowerCase()));
  const visibleItems=activeNav==='Filmes'?items.filter(x=>x.type==='movie'):activeNav==='Séries'?items.filter(x=>x.type==='series'):activeNav==='Animes'?items.filter(x=>/anime|animação|animation/i.test(`${x.genre||''} ${x.title||''} ${x.category||''}`)):activeNav==='Minha Lista'?items.filter(x=>{try{return JSON.parse(localStorage.getItem('vortex.mylist.v1')||'[]').map(String).includes(String(x.id));}catch{return false;}}):items;
  async function handleSignIn(credentials){
    const result=await authService.signIn(credentials);
    setAccount(result.user);
    const next=[{id:'main',name:result.user?.name||'Meu perfil',avatar:'vortex',kids:false}];
    setProfiles(next); updateProfiles(next); setProfile(null); setShowProfiles(true); setAuthStatus('authenticated');
  }
  async function handleSignUp(credentials){
    const result=await authService.signUp(credentials);
    setAccount(result.user);
    const next=[{id:'main',name:result.user?.name||credentials.name||'Meu perfil',avatar:'vortex',kids:false}];
    setProfiles(next); updateProfiles(next); setProfile(null); setShowProfiles(true); setAuthStatus('authenticated');
  }
  async function handleSignOut(){
    try { await authService.signOut(); } catch(error) { console.warn('[VORTEX] Encerramento remoto da sessão falhou:', error.message); }
    setAccount(null); setProfile(null); setShowProfiles(true); setAuthStatus('unauthenticated');
  }
  function updateProfiles(next){setProfiles(next);localStorage.setItem(PROFILE_KEY,JSON.stringify(next));}
  async function play(item,extra={}){try{saveProgress(item,Math.min(94,(history.find(h=>h.id===item.id)?.progress||0)+12));setHistory(readHistory());const pb=await fetchPlayback(item.id);setPlaying(item);setPlayback(pb);setPSeason(extra.season||season||1);setPEpisode(extra.episode?.number||extra.episode?.episode_number||extra.episode||1);}catch{setNotice('Não foi possível reproduzir este título.');window.setTimeout(()=>setNotice(''),2800);}}
  async function doSearch(e){e?.preventDefault();if(!search.trim()){const data=await fetchCatalog();if(data?.length)setItems(data);return;}setLoading(true);const data=await fetchSearch(search);if(data?.length)setItems(data);setLoading(false);}
  function openDetails(item){setSelected(item);setSeason(getSeasons(item)[0]?.number||1);window.scrollTo({top:0,behavior:'smooth'});}
  function goHome(){setSelected(null);setSearch('');setSearchOpen(false);setActiveNav('Início');window.scrollTo({top:0,behavior:'smooth'});fetchCatalog().then(d=>{if(d?.length)setItems(d);});}
  const nav=[{name:'Início',icon:Home},{name:'Explorar',icon:Compass},{name:'Filmes',icon:Film},{name:'Séries',icon:Tv},{name:'Animes',icon:Sparkles},{name:'Minha Lista',icon:Plus}];
  if(authStatus==='checking') return <PerfectLoader/>;
  if(authStatus==='unauthenticated') return <AuthScreen onSignIn={handleSignIn} onSignUp={handleSignUp}/>;
  if(showProfiles) return <ProfilesScreen profiles={profiles} onChoose={p=>{setProfile(p);setShowProfiles(false);}} onUpdate={updateProfiles} items={items} account={account} onSignOut={handleSignOut}/>;
  if(showSettings) return <SettingsPanel onBack={()=>setShowSettings(false)} profile={profile} onSaveProfile={(data)=>{ if(!profile) return; const nextProfile={...profile, name:(data.name||profile.name).trim()||profile.name, kids:!!data.kidsMode}; setProfile(nextProfile); updateProfiles(profiles.map(p=>p.id===profile.id?nextProfile:p)); }} />;
  if(loading) return <PerfectLoader/>;
  if(selected){const backdrop=img(selected.backdrop, img(selected.poster));const seasons=getSeasons(selected);const activeSeason=seasons.find(s=>s.number===season)||seasons[0];const episodes=activeSeason?.episodes||[];return <div className="app-shell details-page"><header className="site-header"><button className="brand" onClick={goHome}><span className="brand-symbol">V</span><span>VORTEX</span></button><button className="back-button" onClick={goHome}><ArrowLeft size={17}/> <span>Voltar</span></button><div className="header-actions"><button className="icon-button" onClick={()=>setShowSettings(true)} aria-label="Configurações" title="Configurações"><Settings size={18}/></button><button className="profile-mini" onClick={()=>setShowProfiles(true)}><span>{profile?.name?.slice(0,1)||'V'}</span></button></div></header><section className="details-hero" style={{'--hero-image':`url("${backdrop||''}")`}}><div className="details-shade"/><div className="details-info"><p className="eyebrow">{selected.type==='series'?'SÉRIE':'FILME'} <span>•</span> {selected.genre||'ENTRETENIMENTO'}</p><h1>{selected.title}</h1><div className="hero-meta"><span>{selected.year||'—'}</span>{selected.rating&&<span className="rating-chip">★ {selected.rating}</span>}<span>{selected.type==='series'?'Série':'Longa-metragem'}</span></div><p className="details-synopsis">{selected.synopsis||selected.overview||'Descubra os detalhes desta história no VORTEX.'}</p><div className="hero-buttons"><button className="primary-button" onClick={()=>play(selected)}><Play size={17} fill="currentColor"/> Assistir agora</button><button className="secondary-button" onClick={()=>setNotice('Adicione favoritos quando sua conta estiver conectada.') }><Plus size={17}/> Minha lista</button></div></div><div className="details-gradient-bottom"/></section>
    {selected.type==='series'?<><section className="episodes-section"><div className="section-title"><div><span className="section-kicker">CONTINUE A HISTÓRIA</span><h2>Episódios</h2></div>{seasons.length>0&&<label className="season-select-label">Temporada <select value={activeSeason?.number||season} onChange={e=>setSeason(Number(e.target.value))}>{seasons.map(s=><option key={s.number} value={s.number}>Temporada {s.number}</option>)}</select></label>}</div>{episodes.length?<div className="episode-grid">{episodes.map((ep,i)=><article className="episode-card" key={`${activeSeason?.number}-${ep.id||ep.number||i}`}><button className="episode-thumb" onClick={()=>play(selected,{season:activeSeason?.number||season,episode:ep})} style={{backgroundImage:`linear-gradient(0deg,#090b10cc,transparent),url("${img(ep.still_path||ep.still||ep.image||ep.thumbnail,backdrop)||''}")`}}><span className="episode-play"><Play size={18} fill="currentColor"/></span><span className="episode-duration">{ep.runtime?`${ep.runtime} min`: `EP ${ep.episode_number||ep.number||i+1}`}</span></button><div className="episode-copy"><span>EPISÓDIO {ep.episode_number||ep.number||i+1}</span><h3>{ep.name||ep.title||`Episódio ${ep.episode_number||ep.number||i+1}`}</h3>{(ep.overview||ep.synopsis)&&<p>{ep.overview||ep.synopsis}</p>}</div></article>)}</div>:<div className="empty-state"><Clapperboard size={28}/><h3>Episódios indisponíveis</h3><p>A API ainda não forneceu a lista de episódios desta temporada.</p></div>}</section><CastSection item={selected}/></>:<><CastSection item={selected}/></>}
    <footer className="site-footer"><span className="brand-symbol">V</span><span>Histórias que atravessam dimensões.</span><span>© 2026 VORTEX</span></footer>{notice&&<div className="toast"><Check size={15}/>{notice}</div>}{playing&&playback&&<PlayerModal item={playing} playback={playback} season={pSeason} setSeason={setPSeason} episode={pEpisode} setEpisode={setPEpisode} onClose={()=>{setPlaying(null);setPlayback(null);}}/>}</div>;
  }
  return <div className="app-shell"><header className="site-header"><button className="brand" onClick={goHome}><span className="brand-symbol">V</span><span>VORTEX</span></button><button className="mobile-menu-button icon-button" onClick={()=>setMobileMenu(v=>!v)} aria-label="Abrir navegação"><SlidersHorizontal/></button><nav className={`main-nav ${mobileMenu?'mobile-open':''}`}>{nav.map(({name,icon:Icon})=><button key={name} className={activeNav===name?'active':''} onClick={()=>{setActiveNav(name);setMobileMenu(false);if(name==='Início')goHome();}}><Icon size={16}/>{name}</button>)}</nav><div className="header-actions">{searchOpen?<form className="search-form" onSubmit={doSearch}><Search size={17}/><input autoFocus placeholder="Buscar filmes e séries" value={search} onChange={e=>setSearch(e.target.value)}/><button type="button" onClick={()=>{setSearchOpen(false);setSearch('');}} aria-label="Fechar busca"><X size={16}/></button></form>:<button className="icon-button search-trigger" onClick={()=>setSearchOpen(true)} aria-label="Buscar"><Search/></button>}<button className="icon-button settings-trigger" onClick={()=>setShowSettings(true)} aria-label="Configurações" title="Configurações"><Settings size={18}/></button><button className="profile-mini" onClick={()=>setShowProfiles(true)} title="Trocar perfil"><span>{profile?.name?.slice(0,1)||'V'}</span></button></div></header>
  <main>{search?<section className="catalog-page"><div className="page-heading"><span className="section-kicker">PESQUISA</span><h1>Resultados para <em>“{search}”</em></h1><p>{filtered.length} títulos encontrados no catálogo carregado.</p></div>{filtered.length?<div className="catalog-grid">{filtered.map(item=><PosterCard key={item.id} item={item} onDetails={openDetails} onPlay={play}/>)}</div>:<div className="empty-state"><Search size={30}/><h3>Nenhum título encontrado</h3><p>Tente outro nome ou confira a grafia.</p></div>}</section>:activeNav!=='Início'?<section className="catalog-page"><div className="page-heading"><span className="section-kicker">EXPLORE O CATÁLOGO</span><h1>{activeNav}</h1><p>Uma nova história espera por você.</p></div>{visibleItems.length?<div className="catalog-grid">{visibleItems.map(item=><PosterCard key={item.id} item={item} onDetails={openDetails} onPlay={play}/>)}</div>:<div className="empty-state"><Film size={30}/><h3>Estamos preparando a seleção</h3><p>Não há títulos desta categoria disponíveis agora.</p></div>}</section>:<><section key={hero?.id||hero?.title} className="hero" style={{'--hero-image':`url("${img(hero?.backdrop,img(hero?.poster,''))}")`}}><div className="hero-shade"/><div className="hero-content"><div className="hero-kicker"><Sparkles size={14}/> SEU PRÓXIMO UNIVERSO COMEÇA AQUI</div><h1>{hero?.title||'Descubra novas histórias'}</h1><div className="hero-meta"><span>{hero?.year||'Destaque'}</span>{hero?.rating&&<span className="rating-chip">★ {hero.rating}</span>}<span>{hero?.genre||'VORTEX SELECTION'}</span></div><p className="hero-description">{hero?.synopsis||hero?.overview||'Explore filmes e séries selecionados para sua próxima sessão.'}</p><div className="hero-buttons"><button className="primary-button" onClick={()=>play(hero)}><Play size={17} fill="currentColor"/> Assistir agora</button><button className="secondary-button" onClick={()=>openDetails(hero)}><Info size={17}/> Mais informações</button></div><div className="hero-index"><span/> DESTAQUE DO VORTEX <div className="hero-dots" aria-label="Destaques do VORTEX">{heroCandidates.slice(0,10).map((item,index)=><button key={item.id||item.title} className={index===heroIndex%Math.max(heroCandidates.length,1)?'active':''} onClick={()=>setHeroIndex(index)} aria-label={`Mostrar destaque ${index+1}: ${item.title}`} title={item.title}/>)}</div></div></div></section><div className="home-content">{continueItems.length>0&&<ContentRow title="Continue assistindo" subtitle="Retome exatamente de onde parou" items={continueItems} onDetails={openDetails} onPlay={play} progress/>}<ContentRow title="Em alta no VORTEX" subtitle="Histórias que merecem entrar na sua lista" items={topTen} onDetails={openDetails} onPlay={play} ranked/><ContentRow title="Filmes para sua próxima sessão" items={items.filter(x=>x.type==='movie').slice(0,20)} onDetails={openDetails} onPlay={play}/><ContentRow title="Séries para maratonar" items={items.filter(x=>x.type==='series').slice(0,20)} onDetails={openDetails} onPlay={play}/></div></>}</main><footer className="site-footer"><span className="brand-symbol">V</span><span>Histórias que atravessam dimensões.</span><span>© 2026 VORTEX</span></footer>{notice&&<div className="toast"><Check size={15}/>{notice}</div>}{playing&&playback&&<PlayerModal item={playing} playback={playback} season={pSeason} setSeason={setPSeason} episode={pEpisode} setEpisode={setPEpisode} onClose={()=>{setPlaying(null);setPlayback(null);}}/>}<MobileDock active={activeNav} onChange={n=>{setActiveNav(n);if(n==='Início')goHome();}} onProfiles={()=>setShowProfiles(true)}/></div>;
}
function PosterCard({item,onDetails,onPlay}){return <article className="catalog-card"><button className="catalog-poster" onClick={()=>onDetails(item)} style={{backgroundImage:`url("${img(item.poster,'')}")`}} aria-label={`Detalhes de ${item.title}`}><span className="poster-overlay"><span className="poster-play"><Play size={17} fill="currentColor"/></span><span>Ver detalhes</span></span></button><div className="catalog-card-info"><button className="catalog-title" onClick={()=>onDetails(item)}>{item.title}</button><span>{item.year||'—'} · {item.type==='series'?'Série':'Filme'}</span><button className="quick-play" onClick={()=>onPlay(item)} aria-label={`Assistir ${item.title}`}><Play size={14} fill="currentColor"/></button></div></article>;}
function ContentRow({title,subtitle,items,onDetails,onPlay,ranked,progress}){const [offset,setOffset]=useState(0);if(!items?.length)return null;return <section className="content-section"><div className="section-title"><div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><div className="row-controls"><button className="row-arrow" disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-3))} aria-label="Anterior"><ChevronLeft size={18}/></button><button className="row-arrow" disabled={offset>=items.length-5} onClick={()=>setOffset(Math.min(Math.max(0,items.length-5),offset+3))} aria-label="Próximo"><ChevronRight size={18}/></button></div></div><div className="poster-track">{items.slice(offset,offset+8).map((item,i)=><article className={`poster-card ${ranked?'ranked-card':''}`} key={item.id}>{ranked&&<span className="rank-number">{String(offset+i+1).padStart(2,'0')}</span>}<button className="poster-image" style={{backgroundImage:`url("${img(item.poster,'')}")`}} onClick={()=>onDetails(item)} aria-label={`Detalhes de ${item.title}`}><span className="poster-hover"><span className="mini-play"><Play size={13} fill="currentColor"/></span><span className="poster-hover-title">{item.title}</span></span>{progress&&<span className="progress-track"><i style={{width:`${item.progress||12}%`}}/></span>}</button><div className="poster-caption"><button onClick={()=>onDetails(item)}>{item.title}</button><button className="tiny-play" onClick={()=>onPlay(item)} aria-label={`Assistir ${item.title}`}><Play size={12} fill="currentColor"/></button></div></article>)}</div></section>;}
function MobileDock({active,onChange,onProfiles}){return <nav className="mobile-dock"><button className={active==='Início'?'active':''} onClick={()=>onChange('Início')}><Home/><span>Início</span></button><button className={active==='Filmes'?'active':''} onClick={()=>onChange('Filmes')}><Film/><span>Filmes</span></button><button className={active==='Séries'?'active':''} onClick={()=>onChange('Séries')}><Tv/><span>Séries</span></button><button onClick={onProfiles}><UserRound/><span>Perfil</span></button></nav>;}
