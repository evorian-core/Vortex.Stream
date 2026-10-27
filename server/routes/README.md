# API contract planned for VORTEX 3.0

These endpoints are design targets and are not exposed by the current API yet. Do not wire the UI to them until server-side authentication, authorization and database access are implemented and tested.

- `POST /api/auth/signup` — create account and initial session.
- `POST /api/auth/login` — validate credentials and issue secure session.
- `POST /api/auth/logout` — revoke session.
- `GET /api/auth/session` — current authenticated account.
- `GET /api/profiles` / `POST /api/profiles` — list/create profiles belonging to the session account.
- `PATCH /api/profiles/:profileId` / `DELETE /api/profiles/:profileId` — manage own profiles only.
- `GET /api/profiles/:profileId/preferences` / `PUT ...` — theme and preferences.
- `GET /api/profiles/:profileId/progress` / `PUT ...` — synchronize playback progress.
- `GET /api/profiles/:profileId/favorites` / `PUT ...` — synchronize favorites.

All account/profile routes must enforce ownership server-side. Never trust a user/profile ID supplied by the browser without validating the authenticated session.
