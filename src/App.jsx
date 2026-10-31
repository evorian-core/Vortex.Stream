import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Play, Plus, Info, ChevronRight, ChevronLeft, X, Check,
  UserRound, ArrowLeft, Home, Clapperboard, Tv, Compass, Settings,
  Sparkles, Film, CircleUserRound, SlidersHorizontal
} from 'lucide-react';

import { catalog as demoCatalog } from './data/catalog';
import {
  fetchCatalog,
  fetchPlayback,
  fetchSearch,
  fetchTopTen,
  getCachedTopTen,
  fetchCredits
} from './services/api';
import { readHistory } from './services/watchHistory';
import SettingsPanel from './components/SettingsPanel';

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

const buildAvatars = () => AVATARS;
const PROFILE_KEY = 'vortex.profiles.v1';

const defaultProfiles = [
  { id: 'main', name: 'Meu perfil', avatar: 'vortex', kids: false }
];

const readProfiles = () => {
  try {
    const profiles = JSON.parse(
      localStorage.getItem(PROFILE_KEY) || 'null'
    );

    return Array.isArray(profiles) && profiles.length
      ? profiles
      : defaultProfiles;
  } catch {
    return defaultProfiles;
  }
};

const img = (value, fallback = '') =>
  typeof value === 'string' && value.startsWith('http')
    ? value
    : fallback;

const getCast = item => {
  const raw =
    item?.cast ||
    item?.actors ||
    item?.credits?.cast ||
    item?.credits?.actors ||
    [];

  if (Array.isArray(raw)) {
    return raw
      .map((person, index) =>
        typeof person === 'string'
          ? {
              id: `${person}-${index}`,
              name: person,
              character: ''
            }
          : {
              id: person.id || `${person.name}-${index}`,
              name: person.name || person.original_name || 'Artista',
              character: person.character || person.role || ''
            }
      )
      .filter(person => person.name);
  }

  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((name, index) => ({
        id: `${name}-${index}`,
        name: name.trim(),
        character: ''
      }))
      .filter(person => person.name);
  }

  return [];
};

const getSeasons = item => {
  const raw =
    item?.seasons ||
    item?.episodes_by_season ||
    item?.number_of_seasons_data ||
    [];

  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((season, index) => ({
        number: Number(
          season.number ?? season.season_number ?? index + 1
        ),
        episodes: Array.isArray(season.episodes)
          ? season.episodes
          : []
      }))
      .filter(season => season.number > 0)
      .sort((a, b) => a.number - b.number);
  }

  const episodes = Array.isArray(item?.episodes)
    ? item.episodes
    : [];

  if (episodes.length) {
    const groups = new Map();

    episodes.forEach((episode, index) => {
      const number = Number(
        episode.season_number ?? episode.season ?? 1
      );

      if (!groups.has(number)) {
        groups.set(number, []);
      }

      groups.get(number).push({
        ...episode,
        number: Number(
          episode.episode_number ?? episode.number ?? index + 1
        ),
        title:
          episode.name ||
          episode.title ||
          `Episódio ${episode.episode_number ?? episode.number ?? index + 1}`
      });
    });

    return [...groups.entries()]
      .map(([number, episodes]) => ({ number, episodes }))
      .sort((a, b) => a.number - b.number);
  }

  return [];
};

function PerfectLoader() {
  return (
    <div className="loading-screen">
      <div className="loader-mark">
        <span>V</span>
      </div>
      <div className="loader-word">VORTEX</div>
      <p>Preparando sua próxima história</p>
      <div className="loading-line">
        <i />
      </div>
    </div>
  );
}

function CastSection({ item }) {
  const [cast, setCast] = useState(() => getCast(item));
  const [castLoading, setCastLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    const existing = getCast(item);

    setCast(existing);

    if (existing.length || !item?.id) {
      return () => {
        alive = false;
      };
    }

    setCastLoading(true);

    fetchCredits(item.id, item.type)
      .then(data => {
        if (!alive) return;

        const normalized = Array.isArray(data)
          ? data
              .map((person, index) =>
                typeof person === 'string'
                  ? {
                      id: `${person}-${index}`,
                      name: person,
                      character: ''
                    }
                  : {
                      id: person.id || `${person.name}-${index}`,
                      name:
                        person.name ||
                        person.original_name ||
                        'Artista',
                      character: person.character || person.role || ''
                    }
              )
              .filter(person => person.name)
          : [];

        setCast(normalized);
      })
      .catch(error => {
        console.info(
          '[VORTEX] Elenco remoto indisponível para este título:',
          error.message
        );
      })
      .finally(() => {
        if (alive) setCastLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [item?.id, item?.type]);

  return (
    <section className="cast-section">
      <div className="section-title">
        <div>
          <span className="section-kicker">POR TRÁS DA HISTÓRIA</span>
          <h2>Elenco</h2>
        </div>

        <span className="section-count">
          {cast.length
            ? `${cast.length} nomes`
            : 'Informações do elenco'}
        </span>
      </div>

      {cast.length ? (
        <div className="cast-track">
          {cast.map(person => (
            <article className="cast-card" key={person.id}>
              <div className="cast-avatar">
                <CircleUserRound size={27} />
              </div>
              <div>
                <strong>{person.name}</strong>
                <span>{person.character || 'Elenco'}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted-note">
          {castLoading
            ? 'Carregando informações do elenco…'
            : 'O elenco ainda não está disponível para este título.'}
        </p>
      )}
    </section>
  );
}

function PlayerModal({
  item,
  playback,
  season,
  setSeason,
  episode,
  setEpisode,
  onClose
}) {
  const [url, setUrl] = useState('');
  const seasons = getSeasons(item);

  useEffect(() => {
    if (!playback) return;

    if (playback.type === 'serie' || item.type === 'series') {
      setUrl(
        playback.buildUrl
          ? playback.buildUrl(season, episode, '#noEpList')
          : `${playback.playerUrl}/${season}/${episode}#noEpList`
      );
    } else {
      setUrl(playback.playerUrlNoList || playback.playerUrl || '');
    }
  }, [season, episode, playback, item.type]);

  if (!playback || !url) return null;

  return (
    <div
      className="player-overlay"
      onClick={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="player-modal">
        <div className="player-header">
          <div>
            <span className="section-kicker">VORTEX PLAYER</span>
            <h3>{item.title}</h3>
          </div>

          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Fechar player"
          >
            <X />
          </button>
        </div>

        <div className="player-frame">
          <iframe
            src={url}
            title={item.title}
            width="100%"
            height="100%"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; encrypted-media; fullscreen"
          />
        </div>

        {(playback.type === 'serie' || item.type === 'series') && (
          <div className="player-controls">
            <label>
              Temporada
              <select
                value={season}
                onChange={event => setSeason(Number(event.target.value))}
              >
                {(seasons.length
                  ? seasons
                  : Array.from({ length: 10 }, (_, index) => ({
                      number: index + 1
                    }))
                ).map(value => (
                  <option key={value.number} value={value.number}>
                    {value.number}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Episódio
              <select
                value={episode}
                onChange={event => setEpisode(Number(event.target.value))}
              >
                {Array.from({ length: 40 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfilesScreen({ profiles, onChoose, onUpdate, items }) {
  const avatars = buildAvatars(items);

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('vortex');
  const [kids, setKids] = useState(false);

  function createProfile(event) {
    event.preventDefault();

    if (!name.trim()) return;

    const next = [
      ...profiles,
      {
        id: `profile-${Date.now()}`,
        name: name.trim(),
        avatar,
        kids
      }
    ];

    onUpdate(next);
    setName('');
    setAvatar('vortex');
    setKids(false);
    setEditing(false);
  }

  return (
    <main className="profiles-screen">
      <div className="profiles-brand">
        <span className="brand-symbol">V</span>
        <span>VORTEX</span>
      </div>

      <div className="profiles-main">
        <span className="section-kicker">
          SEU UNIVERSO, SUAS REGRAS
        </span>

        <h1>Quem está assistindo?</h1>
        <p>Escolha um perfil para continuar de onde parou.</p>

        <div className="profile-grid">
          {profiles.map(profile => {
            const selectedAvatar =
              avatars.find(value => value.id === profile.avatar) ||
              AVATARS[0];

            return (
              <button
                className="profile-tile"
                key={profile.id}
                onClick={() => onChoose(profile)}
              >
                <span
                  className={`profile-avatar avatar-${selectedAvatar.tone || 'violet'}`}
                  aria-hidden="true"
                >
                  {selectedAvatar.id === 'vortex' ? (
                    <img src="/logo-v.png" alt="" />
                  ) : (
                    <span className="avatar-monogram">
                      {selectedAvatar.name.slice(0, 1)}
                    </span>
                  )}

                  <span className="avatar-badge">
                    {profile.kids ? 'KIDS' : 'V'}
                  </span>
                </span>

                <strong>{profile.name}</strong>
              </button>
            );
          })}

          <button
            className="profile-tile add-profile"
            onClick={() => setEditing(value => !value)}
          >
            <span className="add-avatar">
              <Plus size={36} />
            </span>
            <strong>Adicionar perfil</strong>
          </button>
        </div>

        {editing && (
          <form className="profile-editor" onSubmit={createProfile}>
            <div className="editor-heading">
              <h2>Novo perfil</h2>

              <button
                type="button"
                className="icon-button"
                onClick={() => setEditing(false)}
              >
                <X />
              </button>
            </div>

            <label>
              Nome do perfil
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={24}
                placeholder="Como vamos chamar?"
                required
              />
            </label>

            <span className="field-label">Escolha seu avatar</span>

            <div className="avatar-choices">
              {avatars.map(value => (
                <button
                  type="button"
                  key={value.id}
                  className={`avatar-choice ${avatar === value.id ? 'chosen' : ''}`}
                  onClick={() => setAvatar(value.id)}
                  title={value.name}
                >
                  <span
                    className={`avatar-choice-art avatar-${value.tone || 'violet'}`}
                  >
                    {value.id === 'vortex' ? (
                      <img src="/logo-v.png" alt="" />
                    ) : (
                      <span>{value.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span>{value.name}</span>
                </button>
              ))}
            </div>

            <label className="kids-check">
              <input
                type="checkbox"
                checked={kids}
                onChange={event => setKids(event.target.checked)}
              />
              Perfil infantil
            </label>

            <button className="primary-button" type="submit">
              <Check size={17} /> Criar perfil
            </button>
          </form>
        )}
      </div>

      <p className="profiles-foot">
        Perfis separados. Uma experiência só sua.
      </p>
    </main>
  );
}

const favoritesKey = profileId =>
  `vortex.mylist.v2.${String(profileId || 'main')}`;

function readFavorites(profileId) {
  try {
    const stored = localStorage.getItem(favoritesKey(profileId));

    if (stored !== null) {
      const current = JSON.parse(stored);
      return Array.isArray(current) ? current.map(String) : [];
    }

    if (String(profileId || 'main') === 'main') {
      const legacy = JSON.parse(
        localStorage.getItem('vortex.mylist.v1') || '[]'
      );

      if (Array.isArray(legacy)) return legacy.map(String);
    }

    return [];
  } catch {
    return [];
  }
}

function writeFavorites(profileId, ids) {
  try {
    localStorage.setItem(
      favoritesKey(profileId),
      JSON.stringify([...new Set(ids.map(String))])
    );
  } catch (error) {
    console.warn(
      '[VORTEX] Não foi possível salvar Minha Lista:',
      error
    );
  }
}

export default function App() {
  const [items, setItems] = useState(demoCatalog);

  const [topTen, setTopTen] = useState(
    () => getCachedTopTen() || demoCatalog.slice(0, 10)
  );

  const [history, setHistory] = useState(() => readHistory(null));
  const [favorites, setFavorites] = useState([]);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Início');
  const [season, setSeason] = useState(1);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(null);
  const [playback, setPlayback] = useState(null);
  const [pSeason, setPSeason] = useState(1);
  const [pEpisode, setPEpisode] = useState(1);
  const [notice, setNotice] = useState('');
  const [profiles, setProfiles] = useState(readProfiles);
  const [profile, setProfile] = useState(null);
  const [showProfiles, setShowProfiles] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    let alive = true;

    const cachedTopTen = getCachedTopTen();

    if (cachedTopTen?.length) {
      setTopTen(cachedTopTen);
    }

    (async () => {
      try {
        const catalog = await fetchCatalog();

        if (!alive) return;

        if (catalog?.length) {
          setItems(catalog);

          const trending = await fetchTopTen(catalog);

          if (alive && trending?.length) {
            setTopTen(trending);
          }
        } else {
          const trending = await fetchTopTen();

          if (alive && trending?.length) {
            setTopTen(trending);
          }
        }
      } catch (error) {
        console.error(
          '[VORTEX] Falha ao inicializar catálogo e Top 10:',
          error
        );

        const trending = await fetchTopTen();

        if (alive && trending?.length) {
          setTopTen(trending);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    setHistory(readHistory(profile?.id || null));
    setFavorites(readFavorites(profile?.id || 'main'));
  }, [profile?.id]);

  const heroCandidates = useMemo(() => {
    const combined = [
      ...topTen,
      ...items.filter(item => img(item.backdrop) || img(item.poster))
    ];

    const seen = new Set();

    return combined
      .filter(item => {
        const key = String(item?.id ?? item?.title ?? '');

        if (!key || seen.has(key)) return false;

        seen.add(key);

        return Boolean(img(item.backdrop) || img(item.poster));
      })
      .sort(
        (a, b) =>
          Number(Boolean(img(b.backdrop))) -
          Number(Boolean(img(a.backdrop)))
      )
      .slice(0, 10);
  }, [topTen, items]);

  const hero = heroCandidates.length
    ? heroCandidates[heroIndex % heroCandidates.length]
    : (items.find(item => item.featured) || items[0] || demoCatalog[0]);

  useEffect(() => {
    if (heroCandidates.length < 2) return;

    const timer = window.setInterval(() => {
      setHeroIndex(index => (index + 1) % heroCandidates.length);
    }, 8000);

    return () => window.clearInterval(timer);
  }, [heroCandidates.length]);

  useEffect(() => {
    if (heroIndex >= heroCandidates.length) setHeroIndex(0);
  }, [heroIndex, heroCandidates.length]);

  const continueItems = history
    .filter(entry => Number(entry.progress) > 0)
    .map(entry => {
      const item = items.find(
        value => String(value.id) === String(entry.id)
      );

      return item ? { ...item, progress: entry.progress } : null;
    })
    .filter(Boolean);

  const filtered = items.filter(item =>
    (item.title || '').toLowerCase().includes(search.toLowerCase())
  );

  const visibleItems =
    activeNav === 'Filmes'
      ? items.filter(item => item.type === 'movie')
      : activeNav === 'Séries'
        ? items.filter(item => item.type === 'series')
        : activeNav === 'Animes'
          ? items.filter(item =>
              /anime|animação|animation/i.test(
                `${item.genre || ''} ${item.title || ''} ${item.category || ''}`
              )
            )
          : activeNav === 'Minha Lista'
            ? items.filter(item => favorites.includes(String(item.id)))
            : items;

  function updateProfiles(next) {
    setProfiles(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  }

  function toggleFavorite(item) {
    const id = String(item.id);

    const next = favorites.includes(id)
      ? favorites.filter(value => value !== id)
      : [...favorites, id];

    setFavorites(next);
    writeFavorites(profile?.id || 'main', next);

    setNotice(
      next.includes(id)
        ? 'Adicionado à Minha Lista.'
        : 'Removido da Minha Lista.'
    );

    window.setTimeout(() => setNotice(''), 2200);
  }

  async function play(item, extra = {}) {
    try {
      const result = await fetchPlayback(item.id);

      setPlaying(item);
      setPlayback(result);
      setPSeason(extra.season || season || 1);
      setPEpisode(
        extra.episode?.number ||
        extra.episode?.episode_number ||
        extra.episode ||
        1
      );
    } catch (error) {
      console.error('[VORTEX] Falha na reprodução:', error);

      setNotice('Não foi possível reproduzir este título.');

      window.setTimeout(() => setNotice(''), 2800);
    }
  }

  async function doSearch(event) {
    event?.preventDefault();

    if (!search.trim()) {
      const data = await fetchCatalog();

      if (data?.length) setItems(data);

      return;
    }

    setLoading(true);

    try {
      const data = await fetchSearch(search);

      if (data?.length) setItems(data);
    } finally {
      setLoading(false);
    }
  }

  function openDetails(item) {
    setSelected(item);
    setSeason(getSeasons(item)[0]?.number || 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goHome() {
    setSelected(null);
    setSearch('');
    setSearchOpen(false);
    setActiveNav('Início');

    window.scrollTo({ top: 0, behavior: 'smooth' });

    fetchCatalog().then(data => {
      if (data?.length) setItems(data);
    });
  }

  const nav = [
    { name: 'Início', icon: Home },
    { name: 'Explorar', icon: Compass },
    { name: 'Filmes', icon: Film },
    { name: 'Séries', icon: Tv },
    { name: 'Animes', icon: Sparkles },
    { name: 'Minha Lista', icon: Plus }
  ];

  if (showProfiles) {
    return (
      <ProfilesScreen
        profiles={profiles}
        onChoose={selectedProfile => {
          setProfile(selectedProfile);
          setHistory(readHistory(selectedProfile.id));
          setFavorites(readFavorites(selectedProfile.id));
          setShowProfiles(false);
        }}
        onUpdate={updateProfiles}
        items={items}
      />
    );
  }

  if (showSettings) {
    return (
      <SettingsPanel
        onBack={() => setShowSettings(false)}
        profile={profile}
        onSaveProfile={data => {
          if (!profile) return;

          const nextProfile = {
            ...profile,
            name: (data.name || profile.name).trim() || profile.name,
            kids: !!data.kidsMode
          };

          setProfile(nextProfile);

          updateProfiles(
            profiles.map(value =>
              value.id === profile.id ? nextProfile : value
            )
          );
        }}
      />
    );
  }

  if (loading) return <PerfectLoader />;

  if (selected) {
    const backdrop = img(selected.backdrop, img(selected.poster));
    const seasons = getSeasons(selected);
    const activeSeason = seasons.find(value => value.number === season) || seasons[0];
    const episodes = activeSeason?.episodes || [];

    return (
      <div className="app-shell details-page">
        <header className="site-header">
          <button className="brand" onClick={goHome}>
            <span className="brand-symbol">V</span>
            <span>VORTEX</span>
          </button>

          <button className="back-button" onClick={goHome}>
            <ArrowLeft size={17} />
            <span>Voltar</span>
          </button>

          <div className="header-actions">
            <button
              className="icon-button"
              onClick={() => setShowSettings(true)}
              aria-label="Configurações"
              title="Configurações"
            >
              <Settings size={18} />
            </button>

            <button
              className="profile-mini"
              onClick={() => setShowProfiles(true)}
            >
              <span>{profile?.name?.slice(0, 1) || 'V'}</span>
            </button>
          </div>
        </header>

        <section
          className="details-hero"
          style={{ '--hero-image': `url("${backdrop || ''}")` }}
        >
          <div className="details-shade" />

          <div className="details-info">
            <p className="eyebrow">
              {selected.type === 'series' ? 'SÉRIE' : 'FILME'}
              <span> • </span>
              {selected.genre || 'ENTRETENIMENTO'}
            </p>

            <h1>{selected.title}</h1>

            <div className="hero-meta">
              <span>{selected.year || '—'}</span>

              {selected.rating && (
                <span className="rating-chip">★ {selected.rating}</span>
              )}

              <span>
                {selected.type === 'series' ? 'Série' : 'Longa-metragem'}
              </span>
            </div>

            <p className="details-synopsis">
              {selected.synopsis ||
                selected.overview ||
                'Descubra os detalhes desta história no VORTEX.'}
            </p>

            <div className="hero-buttons">
              <button
                className="primary-button"
                onClick={() => play(selected)}
              >
                <Play size={17} fill="currentColor" />
                Assistir agora
              </button>

              <button
                className="secondary-button"
                onClick={() => toggleFavorite(selected)}
              >
                {favorites.includes(String(selected.id))
                  ? <Check size={17} />
                  : <Plus size={17} />}

                {favorites.includes(String(selected.id))
                  ? 'Na minha lista'
                  : 'Minha lista'}
              </button>
            </div>
          </div>

          <div className="details-gradient-bottom" />
        </section>

        {selected.type === 'series' && (
          <section className="episodes-section">
            <div className="section-title">
              <div>
                <span className="section-kicker">CONTINUE A HISTÓRIA</span>
                <h2>Episódios</h2>
              </div>

              {seasons.length > 0 && (
                <label className="season-select-label">
                  Temporada
                  <select
                    value={activeSeason?.number || season}
                    onChange={event => setSeason(Number(event.target.value))}
                  >
                    {seasons.map(value => (
                      <option key={value.number} value={value.number}>
                        Temporada {value.number}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {episodes.length ? (
              <div className="episode-grid">
                {episodes.map((episode, index) => (
                  <article
                    className="episode-card"
                    key={`${activeSeason?.number}-${episode.id || episode.number || index}`}
                  >
                    <button
                      className="episode-thumb"
                      onClick={() =>
                        play(selected, {
                          season: activeSeason?.number || season,
                          episode
                        })
                      }
                      style={{
                        backgroundImage:
                          `linear-gradient(0deg,#090b10cc,transparent),url("${img(
                            episode.still_path ||
                            episode.still ||
                            episode.image ||
                            episode.thumbnail,
                            backdrop
                          ) || ''}")`
                      }}
                    >
                      <span className="episode-play">
                        <Play size={18} fill="currentColor" />
                      </span>

                      <span className="episode-duration">
                        {episode.runtime
                          ? `${episode.runtime} min`
                          : `EP ${episode.episode_number || episode.number || index + 1}`}
                      </span>
                    </button>

                    <div className="episode-copy">
                      <span>
                        EPISÓDIO {episode.episode_number || episode.number || index + 1}
                      </span>

                      <h3>
                        {episode.name ||
                          episode.title ||
                          `Episódio ${episode.episode_number || episode.number || index + 1}`}
                      </h3>

                      {(episode.overview || episode.synopsis) && (
                        <p>{episode.overview || episode.synopsis}</p>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Clapperboard size={28} />
                <h3>Episódios indisponíveis</h3>
                <p>
                  A API ainda não forneceu a lista de episódios desta temporada.
                </p>
              </div>
            )}
          </section>
        )}

        <CastSection item={selected} />

        <footer className="site-footer">
          <span className="brand-symbol">V</span>
          <span>Histórias que atravessam dimensões.</span>
          <span>© 2026 VORTEX</span>
        </footer>

        {notice && (
          <div className="toast">
            <Check size={15} />
            {notice}
          </div>
        )}

        {playing && playback && (
          <PlayerModal
            item={playing}
            playback={playback}
            season={pSeason}
            setSeason={setPSeason}
            episode={pEpisode}
            setEpisode={setPEpisode}
            onClose={() => {
              setPlaying(null);
              setPlayback(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <button className="brand" onClick={goHome}>
          <span className="brand-symbol">V</span>
          <span>VORTEX</span>
        </button>

        <button
          className="mobile-menu-button icon-button"
          onClick={() => setMobileMenu(value => !value)}
          aria-label="Abrir navegação"
        >
          <SlidersHorizontal />
        </button>

        <nav className={`main-nav ${mobileMenu ? 'mobile-open' : ''}`}>
          {nav.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={activeNav === name ? 'active' : ''}
              onClick={() => {
                setActiveNav(name);
                setMobileMenu(false);
                if (name === 'Início') goHome();
              }}
            >
              <Icon size={16} />
              {name}
            </button>
          ))}
        </nav>

        <div className="header-actions">
          {searchOpen ? (
            <form className="search-form" onSubmit={doSearch}>
              <Search size={17} />

              <input
                autoFocus
                placeholder="Buscar filmes e séries"
                value={search}
                onChange={event => setSearch(event.target.value)}
              />

              <button
                type="button"
                onClick={() => {
                  setSearchOpen(false);
                  setSearch('');
                }}
                aria-label="Fechar busca"
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <button
              className="icon-button search-trigger"
              onClick={() => setSearchOpen(true)}
              aria-label="Buscar"
            >
              <Search />
            </button>
          )}

          <button
            className="icon-button settings-trigger"
            onClick={() => setShowSettings(true)}
            aria-label="Configurações"
            title="Configurações"
          >
            <Settings size={18} />
          </button>

          <button
            className="profile-mini"
            onClick={() => setShowProfiles(true)}
            title="Trocar perfil"
          >
            <span>{profile?.name?.slice(0, 1) || 'V'}</span>
          </button>
        </div>
      </header>

      <main>
        {search ? (
          <section className="catalog-page">
            <div className="page-heading">
              <span className="section-kicker">PESQUISA</span>
              <h1>
                Resultados para <em>“{search}”</em>
              </h1>
              <p>
                {filtered.length} títulos encontrados no catálogo carregado.
              </p>
            </div>

            {filtered.length ? (
              <div className="catalog-grid">
                {filtered.map(item => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    onDetails={openDetails}
                    onPlay={play}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Search size={30} />
                <h3>Nenhum título encontrado</h3>
                <p>Tente outro nome ou confira a grafia.</p>
              </div>
            )}
          </section>
        ) : activeNav !== 'Início' ? (
          <section className="catalog-page">
            <div className="page-heading">
              <span className="section-kicker">EXPLORE O CATÁLOGO</span>
              <h1>{activeNav}</h1>
              <p>Uma nova história espera por você.</p>
            </div>

            {visibleItems.length ? (
              <div className="catalog-grid">
                {visibleItems.map(item => (
                  <PosterCard
                    key={item.id}
                    item={item}
                    onDetails={openDetails}
                    onPlay={play}
                  />
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Film size={30} />
                <h3>Estamos preparando a seleção</h3>
                <p>Não há títulos desta categoria disponíveis agora.</p>
              </div>
            )}
          </section>
        ) : (
          <>
            <section
              key={hero?.id || hero?.title}
              className="hero"
              style={{
                '--hero-image': `url("${img(hero?.backdrop, img(hero?.poster, ''))}")`
              }}
            >
              <div className="hero-shade" />

              <div className="hero-content">
                <div className="hero-kicker">
                  <Sparkles size={14} />
                  SEU PRÓXIMO UNIVERSO COMEÇA AQUI
                </div>

                <h1>{hero?.title || 'Descubra novas histórias'}</h1>

                <div className="hero-meta">
                  <span>{hero?.year || 'Destaque'}</span>

                  {hero?.rating && (
                    <span className="rating-chip">★ {hero.rating}</span>
                  )}

                  <span>{hero?.genre || 'VORTEX SELECTION'}</span>
                </div>

                <p className="hero-description">
                  {hero?.synopsis ||
                    hero?.overview ||
                    'Explore filmes e séries selecionados para sua próxima sessão.'}
                </p>

                <div className="hero-buttons">
                  <button
                    className="primary-button"
                    onClick={() => play(hero)}
                  >
                    <Play size={17} fill="currentColor" />
                    Assistir agora
                  </button>

                  <button
                    className="secondary-button"
                    onClick={() => openDetails(hero)}
                  >
                    <Info size={17} />
                    Mais informações
                  </button>
                </div>

                <div className="hero-index">
                  <span />
                  DESTAQUE DO VORTEX

                  <div className="hero-dots" aria-label="Destaques do VORTEX">
                    {heroCandidates.slice(0, 10).map((item, index) => (
                      <button
                        key={item.id || item.title}
                        className={
                          index === heroIndex % Math.max(heroCandidates.length, 1)
                            ? 'active'
                            : ''
                        }
                        onClick={() => setHeroIndex(index)}
                        aria-label={`Mostrar destaque ${index + 1}: ${item.title}`}
                        title={item.title}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <div className="home-content">
              {continueItems.length > 0 && (
                <ContentRow
                  title="Continue assistindo"
                  subtitle="Retome exatamente de onde parou"
                  items={continueItems}
                  onDetails={openDetails}
                  onPlay={play}
                  progress
                />
              )}

              <ContentRow
                title="Em alta no VORTEX"
                subtitle="Histórias que merecem entrar na sua lista"
                items={topTen}
                onDetails={openDetails}
                onPlay={play}
                ranked
              />

              <ContentRow
                title="Filmes para sua próxima sessão"
                items={items.filter(item => item.type === 'movie').slice(0, 20)}
                onDetails={openDetails}
                onPlay={play}
              />

              <ContentRow
                title="Séries para maratonar"
                items={items.filter(item => item.type === 'series').slice(0, 20)}
                onDetails={openDetails}
                onPlay={play}
              />
            </div>
          </>
        )}
      </main>

      <footer className="site-footer">
        <span className="brand-symbol">V</span>
        <span>Histórias que atravessam dimensões.</span>
        <span>© 2026 VORTEX</span>
      </footer>

      {notice && (
        <div className="toast">
          <Check size={15} />
          {notice}
        </div>
      )}

      {playing && playback && (
        <PlayerModal
          item={playing}
          playback={playback}
          season={pSeason}
          setSeason={setPSeason}
          episode={pEpisode}
          setEpisode={setPEpisode}
          onClose={() => {
            setPlaying(null);
            setPlayback(null);
          }}
        />
      )}

      <MobileDock
        active={activeNav}
        onChange={name => {
          setActiveNav(name);
          if (name === 'Início') goHome();
        }}
        onProfiles={() => setShowProfiles(true)}
      />
    </div>
  );
}

function PosterCard({ item, onDetails, onPlay }) {
  return (
    <article className="catalog-card">
      <button
        className="catalog-poster"
        onClick={() => onDetails(item)}
        style={{ backgroundImage: `url("${img(item.poster, '')}")` }}
        aria-label={`Detalhes de ${item.title}`}
      >
        <span className="poster-overlay">
          <span className="poster-play">
            <Play size={17} fill="currentColor" />
          </span>
          <span>Ver detalhes</span>
        </span>
      </button>

      <div className="catalog-card-info">
        <button
          className="catalog-title"
          onClick={() => onDetails(item)}
        >
          {item.title}
        </button>

        <span>
          {item.year || '—'} · {item.type === 'series' ? 'Série' : 'Filme'}
        </span>

        <button
          className="quick-play"
          onClick={() => onPlay(item)}
          aria-label={`Assistir ${item.title}`}
        >
          <Play size={14} fill="currentColor" />
        </button>
      </div>
    </article>
  );
}

function ContentRow({
  title,
  subtitle,
  items,
  onDetails,
  onPlay,
  ranked,
  progress
}) {
  const [offset, setOffset] = useState(0);

  if (!items?.length) return null;

  return (
    <section className="content-section">
      <div className="section-title">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>

        <div className="row-controls">
          <button
            className="row-arrow"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - 3))}
            aria-label="Anterior"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            className="row-arrow"
            disabled={offset >= items.length - 5}
            onClick={() =>
              setOffset(Math.min(Math.max(0, items.length - 5), offset + 3))
            }
            aria-label="Próximo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="poster-track">
        {items.slice(offset, offset + 8).map((item, index) => (
          <article
            className={`poster-card ${ranked ? 'ranked-card' : ''}`}
            key={item.id}
          >
            {ranked && (
              <span className="rank-number">
                {String(offset + index + 1).padStart(2, '0')}
              </span>
            )}

            <button
              className="poster-image"
              style={{ backgroundImage: `url("${img(item.poster, '')}")` }}
              onClick={() => onDetails(item)}
              aria-label={`Detalhes de ${item.title}`}
            >
              <span className="poster-hover">
                <span className="mini-play">
                  <Play size={13} fill="currentColor" />
                </span>
                <span className="poster-hover-title">{item.title}</span>
              </span>

              {progress && (
                <span className="progress-track">
                  <i style={{ width: `${item.progress || 0}%` }} />
                </span>
              )}
            </button>

            <div className="poster-caption">
              <button onClick={() => onDetails(item)}>
                {item.title}
              </button>

              <button
                className="tiny-play"
                onClick={() => onPlay(item)}
                aria-label={`Assistir ${item.title}`}
              >
                <Play size={12} fill="currentColor" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MobileDock({ active, onChange, onProfiles }) {
  return (
    <nav className="mobile-dock">
      <button
        className={active === 'Início' ? 'active' : ''}
        onClick={() => onChange('Início')}
      >
        <Home />
        <span>Início</span>
      </button>

      <button
        className={active === 'Filmes' ? 'active' : ''}
        onClick={() => onChange('Filmes')}
      >
        <Film />
        <span>Filmes</span>
      </button>

      <button
        className={active === 'Séries' ? 'active' : ''}
        onClick={() => onChange('Séries')}
      >
        <Tv />
        <span>Séries</span>
      </button>

      <button onClick={onProfiles}>
        <UserRound />
        <span>Perfil</span>
      </button>
    </nav>
  );
}