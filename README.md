# Helpdesk 1C

MVP веб-приложения для учета заявок клиентов: React + Vite frontend, Express REST API backend и SQLite.

## Требования

- Node.js 20+
- npm 10+

## Быстрый старт

```bash
npm install
npm run dev
```

На Windows, если PowerShell блокирует `npm.ps1`, используйте `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

После запуска:

- frontend: http://localhost:5173
- backend health-check: http://localhost:4000/api/health

SQLite-файл создается автоматически по пути `backend/data/helpdesk.sqlite`, если его еще нет. При первом запуске на чистой базе backend создает схему и демоданные: клиентов, договоры, сотрудников, заявки, работы и данные для отчетов.

## Команды

```bash
npm run dev          # frontend и backend одновременно
npm run dev:frontend # только Vite frontend
npm run dev:backend  # только Express backend
npm run build        # production build frontend
npm run start        # запуск backend без watch mode
npm test             # backend API smoke + frontend CSV unit test
npm run smoke        # alias для npm test
```

## Окружение

Скопируйте `.env.example` в `.env`, если нужны нестандартные порты или путь к SQLite-файлу.

```env
API_PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
SQLITE_DB_PATH=./data/helpdesk.sqlite
```

`SQLITE_DB_PATH` считается относительно папки `backend`, когда backend запускается через npm workspace.

## Проверка MVP

1. Запустить `npm test` или `npm.cmd test`.
2. Запустить `npm run dev`.
3. Открыть дашборд, заявки, карточку заявки, клиентов, договоры, сотрудников и отчеты.
4. Создать и отредактировать заявку.
5. Добавить работу в карточке заявки.
6. Попробовать удалить клиента с договором: приложение должно показать понятную причину отказа.
7. Сформировать оба отчета и экспортировать CSV.

## Структура

```text
backend/
  src/
    config/
    db/
    routes/
    services/
  test/
frontend/
  src/
    api/
    components/
    pages/
    utils/
```
