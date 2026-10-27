-- VORTEX 3.0 — proposed PostgreSQL schema for Neon.
-- This migration is a design artifact only; it has not been applied to a live database.
-- Authentication implementation must hash passwords with Argon2id/bcrypt and rotate sessions securely.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS vortex_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vortex_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES vortex_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vortex_sessions_user_idx ON vortex_sessions(user_id);
CREATE INDEX IF NOT EXISTS vortex_sessions_expiry_idx ON vortex_sessions(expires_at);

CREATE TABLE IF NOT EXISTS vortex_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES vortex_users(id) ON DELETE CASCADE,
  name VARCHAR(40) NOT NULL,
  avatar_key TEXT,
  is_kids BOOLEAN NOT NULL DEFAULT FALSE,
  theme_id TEXT NOT NULL DEFAULT 'obsidian',
  theme_custom JSONB NOT NULL DEFAULT '{}'::jsonb,
  onboarding_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vortex_profiles_user_idx ON vortex_profiles(user_id);

CREATE TABLE IF NOT EXISTS vortex_favorites (
  profile_id UUID NOT NULL REFERENCES vortex_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series')),
  content_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, content_id)
);

CREATE TABLE IF NOT EXISTS vortex_watch_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES vortex_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series')),
  season_number INTEGER,
  episode_number INTEGER,
  position_seconds INTEGER NOT NULL DEFAULT 0 CHECK (position_seconds >= 0),
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds > 0),
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS vortex_progress_identity_idx ON vortex_watch_progress(profile_id, content_id, COALESCE(season_number, 0), COALESCE(episode_number, 0));
CREATE INDEX IF NOT EXISTS vortex_progress_recent_idx ON vortex_watch_progress(profile_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS vortex_watch_history (
  id BIGSERIAL PRIMARY KEY,
  profile_id UUID NOT NULL REFERENCES vortex_profiles(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('movie', 'series')),
  season_number INTEGER,
  episode_number INTEGER,
  event_type TEXT NOT NULL DEFAULT 'play',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS vortex_history_profile_recent_idx ON vortex_watch_history(profile_id, created_at DESC);

CREATE TABLE IF NOT EXISTS vortex_profile_settings (
  profile_id UUID PRIMARY KEY REFERENCES vortex_profiles(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
