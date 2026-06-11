# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Helpdesk MVP for tracking 1C support tickets. npm workspaces monorepo: `backend` (Express + SQLite) and `frontend` (React 19 + Vite). All UI text, validation messages, and API error messages are in **Russian** — keep new user-facing strings in Russian.

Requires **Node 24+** (better-sqlite3 native module, with `node:sqlite` as fallback).

## Commands

```bash
npm run dev            # backend (port 4000) + frontend (port 5173) together
npm run dev:backend    # backend only, node --watch
npm run dev:frontend   # frontend only
npm test               # backend smoke tests + frontend util tests
npm run seed:demo      # delete backend/data/helpdesk.sqlite and recreate with demo data
npm run build          # production build of frontend
```

Single test file (uses node's built-in test runner, no Jest/Vitest):

```bash
cd backend && node --test test/api.smoke.test.js
cd frontend && node --test src/utils/csv.test.js
```

There is no linter configured.

## Architecture

### Backend (`backend/src/`)

Layering: `routes/*.routes.js` (HTTP parsing, status codes) → `services/*.service.js` (business logic + SQL) → `db/database.js`. Routes are mounted in `app.js` under `/api/*` (health, dashboard, clients, contracts, employees, reports, tickets).

Database specifics:
- `db/database.js` exposes a singleton `getDatabase()`. It tries `better-sqlite3` first and falls back to the built-in `node:sqlite` `DatabaseSync` — code must stay compatible with both (synchronous prepare/get/all/run API).
- On first open, `db/bootstrap.js` runs the full schema, inserts reference data (statuses, categories), and auto-seeds demo data **only if all business tables are empty**. There are no migrations — schema changes go into `SCHEMA_SQL` in `bootstrap.js` and require reseeding (`npm run seed:demo`).
- Foreign keys are `ON DELETE RESTRICT`; services translate constraint violations into Russian 409/400 messages.
- DB path comes from `SQLITE_DB_PATH` (default `./data/helpdesk.sqlite`), resolved relative to the backend working directory. Config lives in `config/env.js` (`.env` via dotenv, see `.env.example`).

Backend tests (`test/api.smoke.test.js`) set `SQLITE_DB_PATH` to a temp dir **before** importing `app.js`, then boot the app on an ephemeral port and hit the real API. Follow that pattern for new API tests.

### Frontend (`frontend/src/`)

No router library and no state-management library:
- `useAppRouter.js` is a small history-API router; `App.jsx` switches pages on `path`. `/` normalizes to `/dashboard`.
- Most pages are **config-driven**: `sections.js` defines `resourcePages` (columns, form fields, API paths, empty-state texts) and the generic `pages/ResourcePage.jsx` renders list + CRUD modals from that config. To add or change a directory section (clients/contracts/employees), edit `sections.js` rather than writing a new page. Tickets and reports have dedicated pages.
- `api/apiClient.js` wraps fetch, throws `ApiError`, and maps server/constraint errors to friendly Russian messages. All API modules go through it. Base URL is `/api` (overridable via `VITE_API_BASE_URL`); in dev, Vite proxies `/api` to the backend (`vite.config.js`, target port from `API_PORT`).

### Docs

`PRD.md` is the product spec; `TASKS.md` and `tasks/0XX-*.md` track the original implementation plan. `docs/report/` contains a practice report (not code documentation).
