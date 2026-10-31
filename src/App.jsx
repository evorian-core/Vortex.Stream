
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
  fetchSeriesDetails,
  fetchSeasonEpisodes
} from './services/api';

import { readHistory, saveProgress } from './services/watchHistory';
import SettingsPanel from './components/SettingsPanel';

const AVATARS = [
  { id: 'vortex', name: 'VORTEX', kind: 'Marca', tone: 'violet', image: '/logo-v.png' },
  ...[
    ['batman', 'Batman', 'Filmes'],
    ['iron-man', 'Homem de Ferro', 'Filmes'],
    ['darth-vader', 'Darth Vader', 'Filmes'],
    ['harry-potter', 'Harry Potter', 'Filmes'],
    ['wandinha', 'Wandinha Addams', 'Séries'],
    ['sherlock', 'Sherlock Holmes', 'Séries'],
    ['jack-sparrow', 'Jack Sparrow', 'Filmes'],
    ['john-wick', 'John Wick', 'Filmes'],
    ['loki', 'Loki', 'Séries'],
    ['luffy', 'Luffy', 'Animes'],
    ['moiraine', 'Moiraine Sedai', 'Séries'],
    ['optimus-prime', 'Optimus Prime', 'Filmes'],
    ['wonder-woman', 'Mulher-Maravilha', 'Filmes'],
    ['deadpool', 'Deadpool', 'Filmes'],
    ['yennefer', 'Yennefer de Vengerberg', 'Séries'],
    ['stitch', 'Stitch', 'Infantil'],
    ['pikachu', 'Pikachu', 'Infantil'],
    ['toothless', 'Banguela', 'Infantil'],
    ['mcqueen', 'Relâmpago McQueen', 'Infantil'],
    ['mike-wazowski', 'Mike Wazowski', 'Infantil'],
    ['elsa', 'Elsa', 'Infantil'],
    ['olaf', 'Olaf', 'Infantil'],
    ['po', 'Po', 'Infantil'],
    ['shrek', 'Shrek', 'Infantil'],
    ['puss-in-boots', 'Gato de Botas', 'Infantil'],
    ['spongebob', 'Bob Esponja', 'Infantil'],
    ['sonic', 'Sonic', 'Infantil'],
    ['totoro', 'Totoro', 'Infantil'],
    ['minion', 'Bob/Minion', 'Infantil'],
    ['mario', 'Mario', 'Infantil']
  ].map(([id, name, kind]) => ({
    id,
    name,
    kind,
    tone: 'violet',
    image: ''
  }))
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
    item?.aggregate_credits?.cast ||
    [];

  const photoUrl = person => {
    const path =
      person?.profile_path ||
      person?.photo ||
      person?.photo_url ||
      person?.image ||
      person?.image_url ||
      person?.avatar ||
      '';

    if (typeof path !== 'string') return '';
    if (/^https?:\/\//i.test(path)) return path;

    if (path.startsWith('/')) {
      return `https://image.tmdb.org/t/p/w185${path}`;
    }

    return '';
  };

  if (Array.isArray(raw)) {
    return raw
      .map((person, index) =>
        typeof person === 'string'
          ? {
              id: `${person}-${index}`,
              name: person,
              character: '',
              photo: ''
            }
          : {
              id: person.id || `${person.name || person.original_name}-${index}`,
              name: person.name || person.original_name || person.actor || 'Artista',
              character:
                person.character ||
                person.role ||
                person.roles?.[0]?.character ||
                '',
              photo: photoUrl(person)
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
        character: '',
        photo: ''
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

  const normalized = new Map();

  if (Array.isArray(raw)) {
    raw.forEach((season, index) => {
      const number = Number(
        season?.number ??
        season?.season_number ??
        season?.season ??
        index + 1
      );

      if (!Number.isFinite(number) || number < 1) return;

      const sourceEpisodes = Array.isArray(season?.episodes)
        ? season.episodes
        : [];

      normalized.set(number, {
        ...season,
        number,
        episodes: sourceEpisodes.map((episode, episodeIndex) => ({
          ...episode,
          number: Number(
            episode?.episode_number ??
            episode?.episodeNumber ??
            episode?.number ??
            episodeIndex + 1
          ),
          title:
            episode?.name ||
            episode?.title ||
            `Episódio ${
              episode?.episode_number ??
              episode?.number ??
              episodeIndex + 1
            }`
        }))
      });
    });
  }

  const episodes = Array.isArray(item?.episodes)
    ? item.episodes
    : [];

  episodes.forEach((episode, index) => {
    const number = Number(
      episode?.season_number ??
      episode?.season ??
      1
    );

    if (!Number.isFinite(number) || number < 1) return;

    if (!normalized.has(number)) {
      normalized.set(number, { number, episodes: [] });
    }

    const season = normalized.get(number);

    const episodeNumber = Number(
      episode?.episode_number ??
      episode?.episodeNumber ??
      episode?.number ??
      index + 1
    );

    if (
      !season.episodes.some(
        existing =>
          Number(existing.number ?? existing.episode_number) === episodeNumber
      )
    ) {
      season.episodes.push({
        ...episode,
        number: episodeNumber,
        title:
          episode?.name ||
          episode?.title ||
          `Episódio ${episodeNumber}`
      });
    }
  });

  return [...normalized.values()]
    .map(season => ({
      ...season,
      episodes: [...season.episodes].sort(
        (a, b) =>
          Number(a.number || a.episode_number || 0) -
          Number(b.number || b.episode_number || 0)
      )
    }))
    .sort((a, b) => a.number - b.number);
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
  const cast = getCast(item);

  return (
    <section className="cast-section">
      <div className="section-title">
        <div>
          <span className="section-kicker">POR TRÁS DA HISTÓRIA</span>
          <h2>Elenco</h2>
        </div>
        <span className="section-count">
          {cast.length ? `${cast.length} nomes` : 'Informações do elenco'}
        </span>
      </div>

      {cast.length ? (
        <div className="cast-track">
          {cast.map(person => (
            <article className="cast-card" key={person.id}>
              <div className="cast-avatar">
                {person.photo ? (
                  <img
                    src={person.photo}
                    alt={person.name}
                    loading="lazy"
                    onError={event => event.currentTarget.remove()}
                  />
                ) : (
                  <CircleUserRound size={27} />
                )}
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
          O elenco ainda não está disponível para este título.
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
    if (!playback) {
      setUrl('');
      return;
    }

    const isSeries =
      ['serie', 'series', 'tv'].includes(
        String(playback.type || item.type).toLowerCase()
      ) || item.type === 'series';

    let next = '';

    if (isSeries) {
      if (typeof playback.buildUrl === 'function') {
        next = playback.buildUrl(season, episode, '#noEpList') || '';
      } else if (playback.playerUrl) {
        next = `${String(playback.playerUrl).replace(/\/+$/, '')}/${season}/${episode}#noEpList`;
      }
    } else {
      next = playback.playerUrlNoList || playback.playerUrl || '';
    }

    setUrl(
      typeof next === 'string' && /^(https?:)?\/\//i.test(next)
        ? next
        : ''
    );
  }, [season, episode, playback, item.type]);

  if (!playback || !url) return null;

  const activeSeason = seasons.find(
    current => current.number === season
  );

  const episodeCount = Math.max(
    1,
    Number(
      activeSeason?.episode_count ||
      activeSeason?.episodeCount ||
      activeSeason?.episodes?.length ||
      episode ||
      1
    )
  );

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
                {(seasons.length ? seasons : [{ number: season }]).map(
                  current => (
                    <option key={current.number} value={current.number}>
                      {current.number}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              Episódio
              <select
                value={episode}
                onChange={event => setEpisode(Number(event.target.value))}
              >
                {Array.from(
                  { length: episodeCount },
                  (_, index) => (
                    <option key={index + 1} value={index + 1}>
                      {index + 1}
                    </option>
                  )
                )}
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
        <span className="section-kicker">SEU UNIVERSO, SUAS REGRAS</span>
        <h1>Quem está assistindo?</h1>
        <p>Escolha um perfil para continuar de onde parou.</p>

        <div className="profile-grid">
          {profiles.map(profile => {
            const selectedAvatar =
              avatars.find(item => item.id === profile.avatar) || AVATARS[0];

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
                  {selectedAvatar.image ? (
                    <img src={selectedAvatar.image} alt="" />
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
              {avatars.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={`avatar-choice ${avatar === item.id ? 'chosen' : ''}`}
                  onClick={() => setAvatar(item.id)}
                  title={item.name}
                >
                  <span className={`avatar-choice-art avatar-${item.tone || 'violet'}`}>
                    {item.image ? (
                      <img src={item.image} alt="" />
                    ) : (
                      <span>{item.name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span>{item.name}</span>
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
              <Check size={17} />
              Criar perfil
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

export default function App() {
  const [items, setItems] = useState(demoCatalog);
  const [topTen, setTopTen] = useState(
    () => getCachedTopTen() || []
  );
  const [history, setHistory] = useState(readHistory);
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeNav, setActiveNav] = useState('Início');

  const [season, setSeason] = useState(1);
  const [seriesDetails, setSeriesDetails] = useState(null);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState('');
  const [seasonReload, setSeasonReload] = useState(0);

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
    : items.find(item => item.featured) || items[0] || demoCatalog[0];

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
    .map(entry => {
      const item = items.find(
        current => String(current.id) === String(entry.id)
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
            ? items.filter(item => {
                try {
                  return JSON.parse(
                    localStorage.getItem('vortex.mylist.v1') || '[]'
                  )
                    .map(String)
                    .includes(String(item.id));
                } catch {
                  return false;
                }
              })
            : items;

  function updateProfiles(next) {
    setProfiles(next);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  }

  async function play(item, extra = {}) {
    try {
      saveProgress(
        item,
        Math.min(
          94,
          (history.find(entry => entry.id === item.id)?.progress || 0) + 12
        )
      );

      setHistory(readHistory());

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
      console.error('[VORTEX] Falha ao iniciar reprodução:', error);
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

    const data = await fetchSearch(search);

    if (data?.length) setItems(data);

    setLoading(false);
  }

  async function openDetails(item) {
    setSelected(item);
    setSeriesDetails(null);
    setEpisodesError('');
    setSeasonReload(0);

    const existingSeasons = getSeasons(item);
    const initialSeason = existingSeasons[0]?.number || 1;

    setSeason(initialSeason);

    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (item.type !== 'series') {
      setEpisodesLoading(false);
      return;
    }

    setEpisodesLoading(true);

    try {
      const details = await fetchSeriesDetails(item.id);

      setSeriesDetails({
        ...details,
        id: item.id
      });

      const availableSeasons = Array.isArray(details.seasons)
        ? details.seasons
        : [];

      const firstSeason =
        availableSeasons.find(entry => Number(entry.number) > 0)?.number ||
        initialSeason;

      setSeason(Number(firstSeason));
    } catch (error) {
      console.error('[VORTEX] Falha ao carregar detalhes da série:', error);

      setEpisodesError(
        'Não foi possível carregar as temporadas. Tente novamente.'
      );
    } finally {
      setEpisodesLoading(false);
    }
  }

  // Carrega os episódios da temporada selecionada.
  useEffect(() => {
    if (!selected || selected.type !== 'series') {
      return undefined;
    }

    let cancelled = false;

    async function loadSeason() {
      setEpisodesLoading(true);
      setEpisodesError('');

      try {
        const data = await fetchSeasonEpisodes(selected.id, season);

        if (cancelled) return;

        setSeriesDetails(previous => {
          const base = previous || selected;
          const previousSeasons = Array.isArray(base.seasons)
            ? base.seasons
            : [];

          const updatedSeason = {
            ...data,
            number: Number(data.number ?? season),
            episodes: data.episodes
          };

          const seasons = previousSeasons.filter(
            entry => Number(entry.number) !== Number(updatedSeason.number)
          );

          seasons.push(updatedSeason);
          seasons.sort((a, b) => Number(a.number) - Number(b.number));

          return {
            ...base,
            ...data,
            id: selected.id,
            seasons
          };
        });
      } catch (error) {
        if (cancelled) return;

        console.error('[VORTEX] Falha ao carregar episódios:', error);

        setEpisodesError(
          'Não foi possível carregar os episódios desta temporada.'
        );
      } finally {
        if (!cancelled) setEpisodesLoading(false);
      }
    }

    loadSeason();

    return () => {
      cancelled = true;
    };
  }, [selected?.id, selected?.type, season, seasonReload]);

  function retrySeason() {
    setSeasonReload(value => value + 1);
  }

  function goHome() {
    setSelected(null);
    setSeriesDetails(null);
    setEpisodesError('');
    setEpisodesLoading(false);
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
            profiles.map(entry =>
              entry.id === profile.id ? nextProfile : entry
            )
          );
        }}
      />
    );
  }

  if (loading) return <PerfectLoader />;

  if (selected) {
    const detailsItem = seriesDetails
      ? { ...selected, ...seriesDetails }
      : selected;

    const backdrop = img(selected.backdrop, img(selected.poster));
    const seasons = getSeasons(detailsItem);

    const activeSeason =
      seasons.find(entry => entry.number === season) || seasons[0];

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
                onClick={() =>
                  setNotice(
                    'Adicione favoritos quando sua conta estiver conectada.'
                  )
                }
              >
                <Plus size={17} />
                Minha lista
              </button>
            </div>
          </div>

          <div className="details-gradient-bottom" />
        </section>

        {selected.type === 'series' ? (
          <>
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
                      onChange={event => {
                        setSeason(Number(event.target.value));
                        setEpisodesError('');
                      }}
                    >
                      {seasons.map(entry => (
                        <option key={entry.number} value={entry.number}>
                          Temporada {entry.number}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              {episodesLoading ? (
                <div className="empty-state">
                  <Clapperboard size={28} />
                  <h3>Carregando episódios…</h3>
                  <p>Buscando os detalhes desta temporada.</p>
                </div>
              ) : episodesError ? (
                <div className="empty-state">
                  <Clapperboard size={28} />
                  <h3>Não foi possível carregar</h3>
                  <p>{episodesError}</p>
                  <button
                    className="secondary-button"
                    onClick={retrySeason}
                  >
                    Tentar novamente
                  </button>
                </div>
              ) : episodes.length > 0 ? (
                <div className="episode-grid">
                  {episodes.map((episode, index) => {
                    const episodeNumber =
                      episode.number ||
                      episode.episode_number ||
                      index + 1;

                    const title =
                      episode.name ||
                      episode.title ||
                      `Episódio ${episodeNumber}`;

                    const still = img(
                      episode.still_path ||
                      episode.still ||
                      episode.image ||
                      episode.thumbnail,
                      backdrop
                    );

                    const duration =
                      episode.runtime ||
                      (
                        typeof episode.duration === 'string'
                          ? parseInt(episode.duration, 10)
                          : episode.duration
                      );

                    return (
                      <article
                        className="episode-card"
                        key={`${activeSeason?.number}-${episode.id || episodeNumber}`}
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
                            backgroundImage: `linear-gradient(0deg,#090b10cc,transparent),url("${still || ''}")`
                          }}
                          aria-label={`Reproduzir ${title}`}
                        >
                          <span className="episode-play">
                            <Play size={18} fill="currentColor" />
                          </span>

                          <span className="episode-duration">
                            {duration
                              ? `${duration} min`
                              : `EP ${episodeNumber}`}
                          </span>
                        </button>

                        <div className="episode-copy">
                          <span>EPISÓDIO {episodeNumber}</span>
                          <h3>{title}</h3>

                          {(episode.overview || episode.synopsis) && (
                            <p>{episode.overview || episode.synopsis}</p>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <Clapperboard size={28} />
                  <h3>Episódios indisponíveis</h3>
                  <p>
                    Esta temporada não possui episódios disponíveis na
                    resposta da API.
                  </p>
                  <button
                    className="secondary-button"
                    onClick={retrySeason}
                  >
                    Atualizar episódios
                  </button>
                </div>
              )}
            </section>

            <CastSection item={detailsItem} />
          </>
        ) : (
          <CastSection item={selected} />
        )}

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
              <p>{filtered.length} títulos encontrados no catálogo carregado.</p>
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
        <button className="catalog-title" onClick={() => onDetails(item)}>
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
    <section
      className={`content-section ${ranked ? 'content-section-ranked' : ''}`}
    >
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

      <div className={`poster-track ${ranked ? 'poster-track-ranked' : ''}`}>
        {items.slice(offset, offset + 8).map((item, index) => (
          <article
            className={`poster-card ${ranked ? 'ranked-card' : ''}`}
            key={item.id || item.title}
          >
            <div className="poster-art">
              {ranked && (
                <span
                  className="rank-number"
                  aria-label={`Posição ${offset + index + 1}`}
                >
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
                    <i style={{ width: `${item.progress || 12}%` }} />
                  </span>
                )}
              </button>
            </div>

            <div className="poster-caption">
              <button onClick={() => onDetails(item)} title={item.title}>
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
