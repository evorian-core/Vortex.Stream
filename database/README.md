# Database setup (future)

The SQL migration here is a proposed PostgreSQL schema for Neon. It has **not** been applied to a live database. Review it before applying. Keep `DATABASE_URL` in the Express hosting environment only; never prefix it with `VITE_` or ship it to the browser.

Planned connection path: React/Capacitor → Express API → Neon PostgreSQL.
