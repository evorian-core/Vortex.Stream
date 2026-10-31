const LEGACY_HISTORY_KEY = 'vortex.history';

const historyKey = profileId =>
  profileId
    ? `vortex.history.${String(profileId)}`
    : LEGACY_HISTORY_KEY;

function parseHistory(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Lê o histórico do perfil informado.
 * Sem profileId, mantém compatibilidade com o histórico antigo.
 */
export const readHistory = (profileId = null) => {
  if (!profileId) {
    return parseHistory(LEGACY_HISTORY_KEY);
  }

  const scopedKey = historyKey(profileId);
  const scoped = parseHistory(scopedKey);

  // Migra o histórico antigo para o perfil principal.
  if (String(profileId) === 'main' && scoped.length === 0) {
    const legacy = parseHistory(LEGACY_HISTORY_KEY);

    if (legacy.length) {
      try {
        localStorage.setItem(scopedKey, JSON.stringify(legacy));
      } catch (error) {
        console.warn('[VORTEX] Não foi possível migrar o histórico:', error);
      }

      return legacy;
    }
  }

  return scoped;
};

/**
 * Salva somente um progresso válido informado pelo chamador.
 * Não aumenta o progresso artificialmente.
 */
export const saveProgress = (item, progress, profileId = null) => {
  if (!item || item.id === undefined || item.id === null) {
    return readHistory(profileId);
  }

  const numericProgress = Number(progress);

  if (
    !Number.isFinite(numericProgress) ||
    numericProgress < 0 ||
    numericProgress > 100
  ) {
    return readHistory(profileId);
  }

  const key = historyKey(profileId);
  const history = readHistory(profileId);
  const id = String(item.id);

  const index = history.findIndex(
    entry => String(entry.id) === id
  );

  const entry = {
    ...(index >= 0 ? history[index] : {}),
    id,
    title:
      item.title ||
      item.name ||
      (index >= 0 ? history[index].title : ''),
    type:
      item.type ||
      (index >= 0 ? history[index].type : undefined),
    progress: Math.round(numericProgress * 10) / 10,
    updatedAt: Date.now(),
  };

  if (index >= 0) {
    history[index] = entry;
  } else {
    history.push(entry);
  }

  try {
    localStorage.setItem(key, JSON.stringify(history.slice(-100)));
  } catch (error) {
    console.warn('[VORTEX] Não foi possível salvar o histórico:', error);
  }

  return readHistory(profileId);
};

/**
 * Remove um título do histórico do perfil informado.
 */
export const clearProgress = (id, profileId = null) => {
  const key = historyKey(profileId);

  const history = parseHistory(key).filter(
    entry => String(entry.id) !== String(id)
  );

  try {
    localStorage.setItem(key, JSON.stringify(history));
  } catch (error) {
    console.warn('[VORTEX] Não foi possível limpar o histórico:', error);
  }

  return history;
};