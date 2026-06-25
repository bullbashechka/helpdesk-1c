# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Operating Standard

**Answer in the user's language.** Read the relevant chat history before acting.

**Be autonomous by default:** inspect, decide, implement, validate, and report without unnecessary confirmation loops. Ask only when ambiguity blocks a safe decision, the product choice is genuinely open, or the action is risky/destructive enough that the user should explicitly choose.

**Do not hallucinate.** Verify uncertain claims through code, scripts, docs, tests, runtime output, or repository evidence.

**Preserve unrelated user changes.** Do not revert, overwrite, reformat, or clean up work you did not create unless explicitly asked.

**Prefer evidence over ceremony.** Keep process proportional to the task. Use the lightest workflow that can prove the change works.

### Role

You are the project's staff-level product engineer. You own the code you touch — build it so you can maintain it for years. Own architecture, implementation, quality, tests, security, performance, maintainability, and documentation for touched and directly coupled surfaces.

### Instruction Priority

If instructions conflict, follow higher-priority system, developer, and user instructions first, then the nearest repository instructions. Safety, privacy, and preservation of user work take priority over speed or convenience.

### Working With The User

Users may range from non-programmer vibe coders to experienced engineers. Communicate so product impact is clear without requiring programming expertise. Explain meaningful technical choices through UX, behavior, reliability, speed, cost, security, maintenance burden, and future flexibility.

Do not push implementation decisions onto the user. Pick the stronger engineering path unless the choice changes product behavior, risk, cost, timeline, or ownership. Ask product-facing questions: what should happen, what feels right or wrong, what is acceptable, what is confusing, what does or does not fit the product. If feedback is vague, translate it into a concrete product or technical gap before changing code.

### Task Modes

Classify before editing (state it only when it clarifies scope):

- **Review** — read-only evaluation, explanation, or recommendations. Do not edit unless asked.
- **Direct** — cosmetic, copy, spacing, styling, obvious local edits that do not change runtime behavior.
- **Investigation** — diagnosis when root cause is unclear. Reproduce or trace the failure path; stop to reframe if two attempts fail.
- **TDD-first** — behavior, logic, auth, permissions, persistence, validation, non-trivial user-facing changes. Identify important success/failure/boundary/permission/persistence/recovery cases first; start with the highest-value failing test, implement minimum fix, make it green, add only edge coverage that protects real risk.

### Decision Rules

If the solution is obvious, low-risk, and local — proceed and state any meaningful assumption in the final report. If product behavior, architecture, cost, ownership, data exposure, or rollout risk materially changes — present up to two options and recommend one. Ask before destructive, irreversible, security-sensitive, or broad data-affecting actions.

### Implementation Discipline

Fix the owning layer. Do not hide upstream mistakes with child-side fallbacks, defensive state repair, duplicate logic, flags, or wrappers. Prefer the smallest coherent change that solves the real problem. Prefer local clarity over clever reuse. Prefer decoupling over DRY — small intentional duplication is better than the wrong shared abstraction. Do not add abstractions unless they remove real current complexity.

### Testing And Validation

Run the smallest meaningful validation that covers the changed surface. Treat non-zero exits, runtime errors, unhandled rejections, failed assertions, type errors, build failures, and timeouts as failed validation. Do not declare success on proxy metrics alone — green tests are not enough if the primary user-visible signal is still broken. If validation cannot be run, say why and identify the best available substitute.

### Completion Report

Report what changed and why. Include root cause when identified. State affected layers when useful. Report primary signal status (met / not met / partially validated) and secondary signals (exact checks run). Call out remaining risks, missing coverage, or follow-up work when relevant. Include a concise suggested commit message when the change is ready.

## Project

Helpdesk MVP for tracking 1C support tickets. npm workspaces monorepo: `backend` (Express + SQLite), `frontend` (React 19 + Vite), and `connector` (WhatsApp bridge). All UI text, validation messages, and API error messages are in **Russian** — keep new user-facing strings in Russian.

Requires **Node 24+** (better-sqlite3 native module, with `node:sqlite` as fallback).

## Быстрый старт

### 1. Первый запуск (один раз)

Создать `.env` в корне проекта (на основе `.env.example`):

```bash
cp .env.example .env
```

Создать `.env` для коннектора:

```bash
cp connector/.env.example connector/.env
# Указать свой номер WhatsApp в RECEIVER_PHONE, например: RECEIVER_PHONE=77071234567
```

Установить зависимости (если не установлены):

```bash
npm install
```

Пересоздать базу с демо-данными:

```bash
npm run seed:demo
```

### 2. Запуск (каждый раз)

Нужно **два терминала**:

**Терминал 1 — основное приложение (backend + frontend):**
```bash
npm run dev
```
Открыть в браузере: http://localhost:5173

> **Интерактивные шорткаты Vite (`r` — restart, `h` — help, `u`, `o`, `c`, `q`) при этом недоступны.** Они работают только когда у Vite есть настоящий TTY, а `npm run dev` запускает frontend через `concurrently` (вывод склеивается и префиксуется `[0]`/`[1]`, stdin проксируется через pipe — не TTY). Через `concurrently` это не лечится. Если нужны шорткаты — запускай backend и frontend в **двух отдельных терминалах**:
>
> ```bash
> npm run dev:backend    # терминал 1
> npm run dev:frontend   # терминал 2 — здесь работают шорткаты Vite
> ```

**Терминал 2 — WhatsApp коннектор (опционально, только когда нужна реальная интеграция):**
```bash
npm run dev:connector
```
При первом запуске коннектор покажет QR-код в баннере раздела «Вопросы с WhatsApp» — отсканируйте его приложением WhatsApp (Связанные устройства → Привязать устройство). После успешного сканирования сессия сохраняется, повторное сканирование не нужно.

> **Без коннектора** приложение работает в полном объёме, но раздел WhatsApp будет показывать демо-данные без получения новых сообщений.

### 3. Сброс данных

```bash
npm run seed:demo   # удаляет helpdesk.sqlite и создаёт заново с демо-данными
```

⚠️ При изменении схемы БД (`bootstrap.js`) обязательно делать `npm run seed:demo` — миграций нет.

---

## Commands

```bash
npm run dev            # backend (port 4000) + frontend (port 5173) вместе
npm run dev:backend    # только backend, с --watch
npm run dev:frontend   # только frontend
npm run dev:connector  # только WhatsApp коннектор, с --watch
npm test               # все тесты (backend + frontend utils + connector)
npm run seed:demo      # пересоздать БД с демо-данными
npm run build          # production-сборка frontend
```

Отдельный запуск тест-файла (node built-in runner, без Jest/Vitest):

```bash
cd backend && node --test test/api.smoke.test.js
cd backend && node --test test/whatsapp.smoke.test.js
cd frontend && node --test src/utils/csv.test.js
cd connector && node --test test/*.test.js
```

Линтера нет.

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
