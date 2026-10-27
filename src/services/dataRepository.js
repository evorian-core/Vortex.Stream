/**
 * VORTEX 3.0 data boundary.
 * Current mode: local preview only. Do not treat localStorage as authenticated cloud storage.
 * Future mode: implement these methods through the Express API backed by Neon PostgreSQL.
 */
const PREVIEW_PREFIX = 'vortex.v3.preview';
const read = (key, fallback) => {
  try {
    const value = localStorage.getItem(`${PREVIEW_PREFIX}.${key}`);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};
const write = (key, value) => {
  try { localStorage.setItem(`${PREVIEW_PREFIX}.${key}`, JSON.stringify(value)); return true; }
  catch { return false; }
};

export const dataRepository = {
  mode: 'preview',
  async getProfiles() { return read('profiles', [{ id: 'preview-profile', name: 'Visitante', theme: 'obsidian', avatar: null }]); },
  async saveProfile(profile) { const profiles = await this.getProfiles(); const next = [...profiles.filter(item => item.id !== profile.id), profile]; write('profiles', next); return profile; },
  async getTheme(profileId = 'preview-profile') { return read(`theme.${profileId}`, 'obsidian'); },
  async saveTheme(profileId = 'preview-profile', theme = 'obsidian') { return write(`theme.${profileId}`, theme); },
  async getFavorites(profileId = 'preview-profile') { return read(`favorites.${profileId}`, []); },
  async saveFavorites(profileId = 'preview-profile', favorites = []) { return write(`favorites.${profileId}`, favorites); },
  async getProgress(profileId = 'preview-profile') { return read(`progress.${profileId}`, []); },
  async saveProgress(profileId = 'preview-profile', progress = []) { return write(`progress.${profileId}`, progress); },
};

/**
 * Neon integration contract (future server-side implementation):
 * - Keep DATABASE_URL only in the Express server environment.
 * - Use the official PostgreSQL driver in server/services/database.js.
 * - The browser must never connect directly to Neon using DATABASE_URL.
 * - Auth/session verification and ownership checks must run server-side.
 */
