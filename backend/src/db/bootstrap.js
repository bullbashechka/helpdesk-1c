import { recalculateAutoCategories } from '../services/wa-categories.js';

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    tax_id TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL UNIQUE,
    position TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    number TEXT NOT NULL UNIQUE,
    start_date TEXT,
    end_date TEXT,
    support_type TEXT,
    tariff TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    responsible_employee_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deadline TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (responsible_employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS work_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    work_date TEXT NOT NULL DEFAULT (date('now')),
    description TEXT NOT NULL,
    hours REAL NOT NULL CHECK (hours >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS wa_receivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS wa_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wa_message_id TEXT NOT NULL UNIQUE,
    receiver_id INTEGER NOT NULL,
    sender_phone TEXT NOT NULL,
    sender_name TEXT,
    chat_type TEXT NOT NULL CHECK (chat_type IN ('private', 'group')),
    group_name TEXT,
    body TEXT,
    wa_timestamp TEXT NOT NULL,
    client_id INTEGER,
    processing_status TEXT NOT NULL DEFAULT 'new' CHECK (processing_status IN ('new','in_progress','task_created','archived')),
    category TEXT NOT NULL DEFAULT 'other',
    category_source TEXT NOT NULL DEFAULT 'auto' CHECK (category_source IN ('auto','manual')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (receiver_id) REFERENCES wa_receivers(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS wa_attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('photo','video','document','voice')),
    availability TEXT NOT NULL CHECK (availability IN ('stored','too_large','failed','not_stored')),
    original_name TEXT,
    mime_type TEXT,
    size_bytes INTEGER,
    stored_path TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS wa_connector_status (
    receiver_id INTEGER PRIMARY KEY,
    state TEXT NOT NULL CHECK (state IN ('qr_required', 'ready', 'disconnected')),
    qr_data_url TEXT,
    last_heartbeat_at TEXT,
    regenerate_requested INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (receiver_id) REFERENCES wa_receivers(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS wa_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL UNIQUE,
    client_id INTEGER,
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low','normal','high','urgent')),
    status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','done','closed')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (message_id) REFERENCES wa_messages(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );
`;

const REFERENCE_DATA_SQL = `
  INSERT OR IGNORE INTO statuses (id, code, name, sort_order) VALUES
    (1, 'new', 'Новая', 10),
    (2, 'in_progress', 'В работе', 20),
    (3, 'waiting_client', 'Ожидает клиента', 30),
    (4, 'done', 'Выполнена', 40),
    (5, 'closed', 'Закрыта', 50);

  INSERT OR IGNORE INTO categories (id, code, name, sort_order) VALUES
    (1, 'consultation', 'Консультация', 10),
    (2, 'customization', 'Доработка', 20),
    (3, 'bug', 'Ошибка', 30),
    (4, 'update', 'Обновление', 40),
    (5, 'integration', 'Интеграция', 50),
    (6, 'admin', 'Администрирование', 60);

  INSERT OR IGNORE INTO wa_receivers (id, phone, label, is_active) VALUES
    (1, 'demo', 'Рабочий номер (демо)', 1);
`;

// Идемпотентные миграции колонок: CREATE TABLE IF NOT EXISTS добавляет только
// новые таблицы, но не колонки в уже существующих. Здесь перечислены колонки,
// которые появились в схеме позже, чтобы существующие базы дотягивались до неё
// при старте без reseed и без потери данных. Новые колонки должны иметь DEFAULT
// (требование SQLite для ALTER TABLE ADD COLUMN с NOT NULL).
const COLUMN_MIGRATIONS = [
  {
    table: 'wa_messages',
    column: 'processing_status',
    definition:
      "processing_status TEXT NOT NULL DEFAULT 'new' CHECK (processing_status IN ('new','in_progress','task_created','archived'))",
  },
  {
    table: 'wa_connector_status',
    column: 'regenerate_requested',
    definition: 'regenerate_requested INTEGER NOT NULL DEFAULT 0',
  },
  {
    table: 'wa_messages',
    column: 'category',
    definition: "category TEXT NOT NULL DEFAULT 'other'",
  },
  {
    table: 'wa_messages',
    column: 'category_source',
    definition:
      "category_source TEXT NOT NULL DEFAULT 'auto' CHECK (category_source IN ('auto','manual'))",
  },
];

function tableExists(db, tableName) {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(tableName),
  );
}

function columnExists(db, tableName, columnName) {
  return db
    .prepare(`PRAGMA table_info(${tableName})`)
    .all()
    .some((column) => column.name === columnName);
}

function applyColumnMigrations(db) {
  for (const { table, column, definition } of COLUMN_MIGRATIONS) {
    if (!tableExists(db, table) || columnExists(db, table, column)) {
      continue;
    }
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
  }
}

export function initializeDatabase(db) {
  db.exec(SCHEMA_SQL);
  applyColumnMigrations(db);
  db.exec(REFERENCE_DATA_SQL);

  recalculateAutoCategories(db);
}
