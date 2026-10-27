# VORTEX 3.0 — cinematic streaming experience

This branch of the project introduces the VORTEX 3.0 interface foundation while preserving the current public catalog and playback API.

## Current status

- Cinematic landing page and catalog interface.
- Existing public Express API integration retained (`https://vortex-stream-u8wz.onrender.com`).
- Search, title details, player, favorites and local preview watch progress.
- Theme selector with six complete visual presets.
- Login/sign-up modal UI. Authentication is intentionally **not connected yet**; it does not create fake accounts or store passwords.
- Transparent SVG and PNG branding assets in `public/branding/`.
- Data repository boundary in `src/services/dataRepository.js` for the future server-backed implementation.
- Proposed Neon/PostgreSQL schema in `database/migrations/001_vortex_core.sql`. This file is a schema proposal, not an applied migration.

## Run locally for development

Requirements: Node.js 20+ and npm.

```bash
npm ci
npm run dev
```

The frontend calls the public API directly. Vite does not proxy API requests to localhost.

To build:

```bash
npm run build
```

## Backend

```bash
npm run server
```

Configure backend-only variables using `.env` locally or environment variables in the hosting provider. Use `.env.example` as a template. Never commit `.env` or database credentials.

## Neon integration plan

The browser must never connect directly to Neon using `DATABASE_URL`. The intended request path is:

`React web / Capacitor Android → Express API → Neon PostgreSQL`

Next steps before production authentication:

1. Add the official PostgreSQL driver to the Express server.
2. Add server-side session handling, secure password hashing, rate limiting and email verification/reset flow.
3. Apply the proposed schema after review.
4. Add authorization checks so each session can access only its own account and profiles.
5. Move preview favorites/progress/themes to account/profile-scoped API endpoints.
6. Add automated tests and only then enable account creation.

## Transparent logo assets

- `public/branding/vortex-mark.svg` and `.png`: symbol.
- `public/branding/vortex-wordmark.svg` and `.png`: light wordmark for dark surfaces.
- `public/branding/vortex-wordmark-dark.svg` and `.png`: dark wordmark for light surfaces.

All these files have transparent backgrounds.
