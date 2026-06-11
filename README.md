# Helpdesk 1C

MVP веб-приложения для учета заявок клиентов: React + Vite frontend, Express REST API backend, SQLite на следующих этапах.

## Требования

- Node.js 20+
- npm 10+

## Быстрый старт

```bash
npm install
npm run dev
```

После запуска:

- frontend: http://localhost:5173
- backend health-check: http://localhost:4000/api/health

## Команды

```bash
npm run dev          # frontend и backend одновременно
npm run dev:frontend # только Vite frontend
npm run dev:backend  # только Express backend
npm run build        # production build frontend
npm run start        # запуск backend без watch mode
```

## Окружение

Скопируйте `.env.example` в `.env`, если нужны нестандартные порты или путь к SQLite-файлу.

```env
API_PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
SQLITE_DB_PATH=./data/helpdesk.sqlite
```

## Структура

```text
backend/
  src/
    config/
    routes/
    services/
frontend/
  src/
    api/
    pages/
```
