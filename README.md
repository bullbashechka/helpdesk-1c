# Helpdesk 1C

MVP веб-приложения для учета клиентских заявок по сопровождению 1С. Стек: React + Vite на frontend, Express REST API на backend, SQLite как локальная база данных.

## Требования

- Node.js 24+
- npm 10+

## Быстрый старт

```bash
npm install
npm run dev
```

Если на Windows PowerShell блокирует `npm.ps1`, используйте `npm.cmd`:

```powershell
npm.cmd install
npm.cmd run dev
```

После запуска:

- frontend: `http://localhost:5173`
- backend health-check: `http://localhost:4000/api/health`

Важно: проект ожидает `Node 24+`. На `Node 20` demo seed и backend могут не стартовать, если не собран native-модуль `better-sqlite3`.

## База данных и демо-данные

SQLite-файл создается автоматически по пути `backend/data/helpdesk.sqlite`, если его еще нет.

При первом запуске на пустой базе backend:

- создает схему таблиц;
- заполняет справочники статусов и категорий;
- добавляет демо-данные по тематике 1С-helpdesk.

Текущий demo seed включает:

- 8 клиентов;
- 6 сотрудников;
- 8 договоров;
- 14 заявок;
- 25 записей о выполненных работах.

Чтобы пересоздать локальную базу и заново залить демо-данные:

```bash
cd backend
npm run seed:demo
```

На Windows при необходимости:

```powershell
cd backend
npm.cmd run seed:demo
```

Команда удаляет текущий `backend/data/helpdesk.sqlite`, создает его заново и сразу заполняет тестовыми данными.

## Команды

```bash
npm run dev           # frontend и backend одновременно
npm run dev:frontend  # только Vite frontend
npm run dev:backend   # только Express backend
npm run build         # production build frontend
npm run start         # запуск backend без watch mode
npm test              # backend API smoke + frontend тесты
npm run smoke         # alias для npm test
```

Команды backend:

```bash
cd backend
npm run seed:demo     # пересоздать sqlite и заново залить demo data
npm test              # smoke-тесты backend API
```

## Окружение

Если нужны нестандартные порты или другой путь к БД, используйте `.env` на основе `.env.example`.

```env
API_PORT=4000
FRONTEND_ORIGIN=http://localhost:5173
SQLITE_DB_PATH=./data/helpdesk.sqlite
```

`SQLITE_DB_PATH` интерпретируется относительно папки `backend`, когда backend запускается через npm workspace.

## Модуль «Вопросы с WhatsApp»

В приложении есть раздел «Вопросы с WhatsApp» для ручного разбора входящих сообщений:

- коннектор принимает новые входящие сообщения через внутренний REST API и сохраняет их в SQLite;
- сообщения привязываются к клиентам по нормализованному телефону, если номер найден в справочнике;
- фото, видео и документы сохраняются как вложения и доступны из карточки сообщения;
- оператор открывает сообщение, создаёт из него задачу WhatsApp или отправляет сообщение в архив;
- архив обратим: сообщение можно вернуть в инбокс;
- задачи WhatsApp живут отдельно от основного модуля «Заявки», имеют собственные статусы и приоритеты.

Ключевые endpoint'ы backend:

```text
POST /api/whatsapp/ingest              # приём входящего сообщения от коннектора, нужен X-Connector-Token
POST /api/whatsapp/status              # обновление состояния коннектора, нужен X-Connector-Token
GET  /api/whatsapp/status              # текущее состояние коннектора
GET  /api/whatsapp/messages            # список сообщений, фильтр status
GET  /api/whatsapp/messages/summary    # счётчики сообщений
GET  /api/whatsapp/messages/:id        # карточка сообщения с вложениями
POST /api/whatsapp/messages/:id/archive
POST /api/whatsapp/messages/:id/unarchive
GET  /api/whatsapp/attachments/:id     # просмотр/скачивание сохранённого вложения
GET  /api/whatsapp/tasks               # список задач WhatsApp, фильтр status
GET  /api/whatsapp/tasks/summary       # счётчики задач
POST /api/whatsapp/tasks               # создать задачу из нового сообщения
GET  /api/whatsapp/tasks/:id           # задача с исходным сообщением и вложениями
PUT  /api/whatsapp/tasks/:id           # обновить тему, описание, приоритет, статус
```

Для локальной интеграции коннектора задайте токен в окружении backend:

```env
WHATSAPP_CONNECTOR_TOKEN=change-me
WA_ATTACHMENTS_DIR=./data/wa-attachments
```

## Проверка MVP

1. Запустить `npm test` или `npm.cmd test`.
2. Запустить `npm run dev`.
3. Открыть дашборд, список заявок, карточку заявки, клиентов, договоры, сотрудников, отчеты и раздел «Вопросы с WhatsApp».
4. Создать и отредактировать заявку.
5. Добавить work log в карточке заявки.
6. Попробовать удалить клиента с договором: приложение должно вернуть понятную ошибку.
7. Сформировать оба отчета и экспортировать CSV.
8. Для WhatsApp-модуля проверить сценарии: входящее сообщение → карточка → задача; входящее сообщение → архив → вернуть в инбокс.

## Структура проекта

```text
backend/
  data/
  scripts/
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
