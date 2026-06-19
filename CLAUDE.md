# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Helpdesk MVP for tracking 1C support tickets. npm workspaces monorepo: `backend` (Express + SQLite), `frontend` (React 19 + Vite), and `connector` (WhatsApp bridge). All UI text, validation messages, and API error messages are in **Russian** — keep new user-facing strings in Russian.

Requires **Node 24+** (better-sqlite3 native module, with `node:sqlite` as fallback).

## Commands

```bash
npm run dev            # backend (port 4000) + frontend (port 5173) together
npm run dev:backend    # backend only, node --watch
npm run dev:frontend   # frontend only
npm run dev:connector  # WhatsApp connector only, node --watch
npm test               # backend smoke tests + frontend util tests + connector unit tests
npm run seed:demo      # delete backend/data/helpdesk.sqlite and recreate with demo data
npm run build          # production build of frontend
```

Single test file (uses node's built-in test runner, no Jest/Vitest):

```bash
cd backend && node --test test/api.smoke.test.js
cd backend && node --test test/whatsapp.smoke.test.js
cd frontend && node --test src/utils/csv.test.js
cd connector && node --test test/*.test.js
```

There is no linter configured.

## Architecture

### Backend (`backend/src/`)

Layering: `routes/*.routes.js` (HTTP parsing, status codes) → `services/*.service.js` (business logic + SQL) → `db/database.js`. Routes are mounted in `app.js` under `/api/*` (health, dashboard, clients, contracts, employees, reports, tickets, whatsapp).

Database specifics:
- `db/database.js` exposes a singleton `getDatabase()`. It tries `better-sqlite3` first and falls back to the built-in `node:sqlite` `DatabaseSync` — code must stay compatible with both (synchronous prepare/get/all/run API).
- On first open, `db/bootstrap.js` runs the full schema, inserts reference data (statuses, categories), and auto-seeds demo data **only if all business tables are empty**. There are no migrations — schema changes go into `SCHEMA_SQL` in `bootstrap.js` and require reseeding (`npm run seed:demo`).
- Foreign keys are `ON DELETE RESTRICT`; services translate constraint violations into Russian 409/400 messages.
- DB path comes from `SQLITE_DB_PATH` (default `./data/helpdesk.sqlite`), resolved relative to the backend working directory. Config lives in `config/env.js` (`.env` via dotenv, see `.env.example`).

Backend tests (`test/api.smoke.test.js`, `test/whatsapp.smoke.test.js`) set `SQLITE_DB_PATH` to a temp dir **before** importing `app.js`, then boot the app on an ephemeral port and hit the real API. Follow that pattern for new API tests. `WHATSAPP_CONNECTOR_TOKEN` must also be set before import for WhatsApp tests.

### Frontend (`frontend/src/`)

No router library and no state-management library:
- `useAppRouter.js` is a small history-API router; `App.jsx` switches pages on `path`. `/` normalizes to `/dashboard`.
- Most pages are **config-driven**: `sections.js` defines `resourcePages` (columns, form fields, API paths, empty-state texts) and the generic `pages/ResourcePage.jsx` renders list + CRUD modals from that config. To add or change a directory section (clients/contracts/employees), edit `sections.js` rather than writing a new page. Tickets and reports have dedicated pages.
- `api/apiClient.js` wraps fetch, throws `ApiError`, and maps server/constraint errors to friendly Russian messages. All API modules go through it. Base URL is `/api` (overridable via `VITE_API_BASE_URL`); in dev, Vite proxies `/api` to the backend (`vite.config.js`, target port from `API_PORT`).

### Connector (`connector/src/`)

Standalone Node.js process (`npm run dev:connector`) that bridges WhatsApp and the backend. Runs as a separate workspace — does **not** share code with backend or frontend.

- `wa-client.js` — wraps `whatsapp-web.js` (Puppeteer/LocalAuth). Emits `message` events for new **incoming** messages only (filters `fromMe`, `status@broadcast`, system types, and messages older than `first_auth_at`). Sends QR/ready/disconnected state via `status.js`.
- `queue.js` — file-based queue (`connector/data/queue/`): each message is a JSON file named after its `wa_message_id`. Survives connector restarts.
- `sender.js` — flushes the queue by POSTing to `POST /api/whatsapp/ingest` with exponential-backoff retry on failures.
- `status.js` — periodic heartbeat: POSTs `{ state, qr_data_url }` to `POST /api/whatsapp/status` every `heartbeatIntervalMs`.
- `config.js` — reads env vars: `BACKEND_URL`, `CONNECTOR_TOKEN`, `RECEIVER_PHONE`, `RECEIVER_ID`, `SESSION_DIR`, `QUEUE_DIR`.

Connector tests (`test/filter.test.js`, `test/queue.test.js`) are pure unit tests — they do **not** import `wa-client.js` or Puppeteer.

### Docs

`PRD.md` is the product spec; `TASKS.md` and `tasks/0XX-*.md` track the original implementation plan. `PRD-whatsapp.md` is the WhatsApp module product spec.
