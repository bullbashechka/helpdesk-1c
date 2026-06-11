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
`;

const REFERENCE_DATA_SQL = `
  INSERT OR IGNORE INTO statuses (id, code, name, sort_order) VALUES
    (1, 'new', 'новая', 10),
    (2, 'in_progress', 'в работе', 20),
    (3, 'waiting_client', 'ожидает клиента', 30),
    (4, 'done', 'выполнена', 40),
    (5, 'closed', 'закрыта', 50);

  INSERT OR IGNORE INTO categories (id, code, name, sort_order) VALUES
    (1, 'consultation', 'консультация', 10),
    (2, 'customization', 'доработка', 20),
    (3, 'bug', 'ошибка', 30),
    (4, 'update', 'обновление', 40);
`;

const DEMO_DATA_SQL = `
  INSERT INTO clients (id, name, tax_id, contact_person, phone, email, address) VALUES
    (1, 'ТОО Альфа-Сервис', '220140000001', 'Ирина Смирнова', '+7 701 100 10 10', 'office@alpha-service.kz', 'г. Алматы, ул. Абая, 15'),
    (2, 'ИП Нурланов', '850501300123', 'Нурлан Нурланов', '+7 707 200 20 20', 'nurlan@example.kz', 'г. Астана, пр. Кабанбай батыра, 8'),
    (3, 'ТОО Восток-Трейд', '191240000777', 'Марина Ким', '+7 777 300 30 30', 'support@vostok-trade.kz', 'г. Караганда, ул. Ермекова, 42');

  INSERT INTO employees (id, full_name, position, phone, email) VALUES
    (1, 'Алексей Петров', 'Консультант 1С', '+7 701 400 40 40', 'petrov@helpdesk.local'),
    (2, 'Дана Ахметова', 'Разработчик 1С', '+7 701 500 50 50', 'akhmetova@helpdesk.local'),
    (3, 'Сергей Волков', 'Специалист сопровождения', '+7 701 600 60 60', 'volkov@helpdesk.local');

  INSERT INTO contracts (id, client_id, number, start_date, end_date, support_type, tariff) VALUES
    (1, 1, 'AS-2026-001', date('now', '-5 months'), date('now', '+7 months'), 'ИТС и консультации', 'Стандарт'),
    (2, 2, 'NR-2026-014', date('now', '-4 months'), date('now', '+6 months'), 'Абонентское сопровождение', 'Базовый'),
    (3, 3, 'VT-2026-008', date('now', '-3 months'), date('now', '+9 months'), 'Доработки и обновления', 'Расширенный');

  INSERT INTO tickets (
    id,
    contract_id,
    category_id,
    status_id,
    responsible_employee_id,
    subject,
    description,
    priority,
    created_at,
    deadline
  ) VALUES
    (1, 1, 3, 2, 1, 'Не открывается база 1С', 'После обновления платформа показывает ошибку подключения к информационной базе.', 'urgent', datetime('now', '-8 days'), date('now', '-2 days')),
    (2, 3, 2, 3, 2, 'Настроить печатную форму счета', 'Добавить логотип, банковские реквизиты и подпись ответственного менеджера.', 'high', datetime('now', '-5 days'), date('now', '+3 days')),
    (3, 2, 4, 4, 3, 'Обновить релиз бухгалтерии', 'Установить актуальный релиз конфигурации и проверить регламентированные отчеты.', 'normal', datetime('now', '-12 days'), date('now', '-6 days')),
    (4, 1, 1, 5, 1, 'Консультация по закрытию месяца', 'Объяснить порядок проверки взаиморасчетов и перепроведения документов.', 'low', datetime('now', '-20 days'), date('now', '-18 days'));

  INSERT INTO work_logs (id, ticket_id, employee_id, work_date, description, hours) VALUES
    (1, 1, 1, date('now', '-7 days'), 'Проверено подключение пользователей и журнал регистрации.', 1.5),
    (2, 1, 2, date('now', '-6 days'), 'Найдена ошибка после обновления, подготовлен план исправления.', 2),
    (3, 2, 2, date('now', '-4 days'), 'Собраны требования и подготовлен макет печатной формы.', 2.5),
    (4, 3, 3, date('now', '-10 days'), 'Выполнено обновление тестовой базы и проверка отчетности.', 3),
    (5, 4, 1, date('now', '-19 days'), 'Проведена консультация по закрытию месяца.', 1);
`;

function getCount(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get()?.count ?? 0;
}

function shouldSeedDemoData(db) {
  const businessTables = ['clients', 'contracts', 'employees', 'tickets', 'work_logs'];
  return businessTables.every((tableName) => getCount(db, tableName) === 0);
}

export function initializeDatabase(db) {
  db.exec(SCHEMA_SQL);
  db.exec(REFERENCE_DATA_SQL);

  if (shouldSeedDemoData(db)) {
    db.exec(DEMO_DATA_SQL);
  }
}
