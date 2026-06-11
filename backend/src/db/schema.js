export function createSchema(db) {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      full_name TEXT NOT NULL UNIQUE,
      position TEXT,
      phone TEXT,
      email TEXT UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

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
      hours REAL NOT NULL CHECK (hours > 0),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
      FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT
    );

    CREATE INDEX IF NOT EXISTS idx_contracts_client_id ON contracts(client_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_contract_id ON tickets(contract_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_status_id ON tickets(status_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_category_id ON tickets(category_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_responsible_employee_id ON tickets(responsible_employee_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_deadline ON tickets(deadline);
    CREATE INDEX IF NOT EXISTS idx_work_logs_ticket_id ON work_logs(ticket_id);
    CREATE INDEX IF NOT EXISTS idx_work_logs_employee_id ON work_logs(employee_id);
    CREATE INDEX IF NOT EXISTS idx_work_logs_work_date ON work_logs(work_date);
  `);
}
