import { getDatabase } from '../db/database.js';

const PRIORITY_VALUES = ['low', 'normal', 'high', 'urgent'];
const CLOSED_STATUS_CODE = 'closed';

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function isPriorityValid(priority) {
  return PRIORITY_VALUES.includes(priority);
}

function toNumber(value) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function toInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function getWorkLogsTableSql() {
  return getDatabase()
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'work_logs'")
    .get()?.sql;
}

function ensureWorkLogsHoursConstraint() {
  const sql = getWorkLogsTableSql();

  if (!sql || !sql.includes('CHECK (hours > 0)')) {
    return;
  }

  const db = getDatabase();

  db.exec(`
    ALTER TABLE work_logs RENAME TO work_logs_legacy;
    CREATE TABLE work_logs (
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
    INSERT INTO work_logs (id, ticket_id, employee_id, work_date, description, hours, created_at)
    SELECT id, ticket_id, employee_id, work_date, description, hours, created_at
    FROM work_logs_legacy;
    DROP TABLE work_logs_legacy;
  `);
}

function normalizeTicketPayload(input) {
  const contractId = toInteger(input.contractId);
  const categoryId = toInteger(input.categoryId);
  const statusId = toInteger(input.statusId);
  const responsibleEmployeeId = toInteger(input.responsibleEmployeeId);
  const subject = String(input.subject ?? '').trim();
  const description = isBlank(input.description) ? null : String(input.description).trim();
  const deadlineAt = isBlank(input.deadlineAt) ? null : String(input.deadlineAt).trim();
  const priority = String(input.priority ?? '').trim();

  return {
    categoryId,
    contractId,
    deadlineAt,
    description,
    priority,
    responsibleEmployeeId,
    statusId,
    subject,
  };
}

function validateTicketPayload(payload, mode = 'create') {
  if (
    !payload.contractId ||
    !payload.categoryId ||
    !payload.statusId ||
    !payload.responsibleEmployeeId ||
    !payload.subject ||
    !payload.priority
  ) {
    throw new Error(
      mode === 'create'
        ? 'Для создания заявки заполните договор, категорию, статус, исполнителя, тему и приоритет.'
        : 'Для сохранения заявки заполните договор, категорию, статус, исполнителя, тему и приоритет.',
    );
  }

  if (!isPriorityValid(payload.priority)) {
    throw new Error('Указан некорректный приоритет заявки.');
  }

  if (!getReferenceById('contracts', payload.contractId)) {
    throw new Error('Выбранный договор не найден.');
  }

  if (!getReferenceById('categories', payload.categoryId)) {
    throw new Error('Выбранная категория не найдена.');
  }

  if (!getReferenceById('statuses', payload.statusId)) {
    throw new Error('Выбранный статус не найден.');
  }

  if (!getReferenceById('employees', payload.responsibleEmployeeId)) {
    throw new Error('Выбранный исполнитель не найден.');
  }
}

function mapTicket(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    assigneeName: row.assigneeName,
    categoryCode: row.categoryCode,
    categoryName: row.categoryName,
    categoryId: row.categoryId,
    clientName: row.clientName,
    contractId: row.contractId,
    contractNumber: row.contractNumber,
    createdAt: row.createdAt,
    deadlineAt: row.deadlineAt,
    description: row.description,
    isOverdue: Boolean(row.isOverdue),
    number: `#${row.id}`,
    priority: row.priority,
    responsibleEmployeeId: row.responsibleEmployeeId,
    spentHours: Number(row.spentHours) || 0,
    statusId: row.statusId,
    statusCode: row.statusCode,
    statusName: row.statusName,
    subject: row.subject,
    title: row.subject,
    updatedAt: row.updatedAt,
  };
}

function mapWorkLog(row) {
  return {
    id: row.id,
    description: row.description,
    employeeName: row.employeeName,
    hours: row.hours,
    workDate: row.workDate,
  };
}

function buildListTicketsQuery({ overdueOnly = false, search = '' } = {}) {
  const conditions = [];
  const parameters = [];

  if (search.trim()) {
    conditions.push('(t.subject LIKE ? OR COALESCE(t.description, \'\') LIKE ?)');
    parameters.push(`%${search.trim()}%`, `%${search.trim()}%`);
  }

  if (overdueOnly) {
    conditions.push('t.deadline IS NOT NULL');
    conditions.push('datetime(t.deadline) < datetime(\'now\')');
    conditions.push('s.code != ?');
    parameters.push(CLOSED_STATUS_CODE);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return {
    parameters,
    sql: `
      SELECT
        t.id,
        t.subject,
        t.subject AS title,
        t.description,
        t.priority,
        t.contract_id AS contractId,
        t.category_id AS categoryId,
        t.status_id AS statusId,
        t.responsible_employee_id AS responsibleEmployeeId,
        t.created_at AS createdAt,
        t.deadline AS deadlineAt,
        t.updated_at AS updatedAt,
        clients.name AS clientName,
        ct.number AS contractNumber,
        employees.full_name AS assigneeName,
        s.code AS statusCode,
        s.name AS statusName,
        c.code AS categoryCode,
        c.name AS categoryName,
        COALESCE(SUM(wl.hours), 0) AS spentHours,
        CASE
          WHEN t.deadline IS NOT NULL AND datetime(t.deadline) < datetime('now') AND s.code != '${CLOSED_STATUS_CODE}'
          THEN 1
          ELSE 0
        END AS isOverdue
      FROM tickets t
      INNER JOIN contracts ct ON ct.id = t.contract_id
      INNER JOIN clients ON clients.id = ct.client_id
      INNER JOIN employees ON employees.id = t.responsible_employee_id
      INNER JOIN statuses s ON s.id = t.status_id
      INNER JOIN categories c ON c.id = t.category_id
      LEFT JOIN work_logs wl ON wl.ticket_id = t.id
      ${whereClause}
      GROUP BY
        t.id,
        t.subject,
        t.description,
        t.priority,
        t.contract_id,
        t.category_id,
        t.status_id,
        t.responsible_employee_id,
        t.created_at,
        t.deadline,
        t.updated_at,
        clients.name,
        ct.number,
        employees.full_name,
        s.code,
        s.name,
        c.code,
        c.name
      ORDER BY datetime(t.created_at) DESC, t.id DESC
    `,
  };
}

function getReferenceById(tableName, id) {
  return getDatabase().prepare(`SELECT id FROM ${tableName} WHERE id = ?`).get(id);
}

export function listTickets(options = {}) {
  const { parameters, sql } = buildListTicketsQuery(options);

  return getDatabase()
    .prepare(`
      ${sql}
    `)
    .all(...parameters)
    .map(mapTicket);
}

export function getTicketById(id) {
  const db = getDatabase();
  const ticket = mapTicket(
    db
      .prepare(`
        SELECT
          t.id,
          t.subject,
          t.description,
          t.priority,
          t.contract_id AS contractId,
          t.category_id AS categoryId,
          t.status_id AS statusId,
          t.responsible_employee_id AS responsibleEmployeeId,
          t.created_at AS createdAt,
          t.deadline AS deadlineAt,
          t.updated_at AS updatedAt,
          clients.name AS clientName,
          ct.number AS contractNumber,
          employees.full_name AS assigneeName,
          s.code AS statusCode,
          s.name AS statusName,
          c.code AS categoryCode,
          c.name AS categoryName,
          COALESCE(SUM(wl.hours), 0) AS spentHours,
          CASE
            WHEN t.deadline IS NOT NULL AND datetime(t.deadline) < datetime('now') AND s.code != '${CLOSED_STATUS_CODE}'
            THEN 1
            ELSE 0
          END AS isOverdue
        FROM tickets t
        INNER JOIN contracts ct ON ct.id = t.contract_id
        INNER JOIN clients ON clients.id = ct.client_id
        INNER JOIN employees ON employees.id = t.responsible_employee_id
        INNER JOIN statuses s ON s.id = t.status_id
        INNER JOIN categories c ON c.id = t.category_id
        LEFT JOIN work_logs wl ON wl.ticket_id = t.id
        WHERE t.id = ?
        GROUP BY
          t.id,
          t.subject,
          t.description,
          t.priority,
          t.contract_id,
          t.category_id,
          t.status_id,
          t.responsible_employee_id,
          t.created_at,
          t.deadline,
          t.updated_at,
          clients.name,
          ct.number,
          employees.full_name,
          s.code,
          s.name,
          c.code,
          c.name
      `)
      .get(id),
  );

  if (!ticket) {
    return null;
  }

  const workLogs = db
    .prepare(`
      SELECT
        wl.id,
        wl.description,
        wl.hours,
        wl.work_date AS workDate,
        employees.full_name AS employeeName
      FROM work_logs wl
      INNER JOIN employees ON employees.id = wl.employee_id
      WHERE wl.ticket_id = ?
      ORDER BY date(wl.work_date) DESC, wl.id DESC
    `)
    .all(id)
    .map(mapWorkLog);

  return {
    ...ticket,
    workLogs,
  };
}

export function getTicketMeta() {
  const db = getDatabase();

  return {
    categories: db
      .prepare('SELECT id, code, name FROM categories ORDER BY sort_order')
      .all(),
    contracts: db
      .prepare(`
        SELECT
          ct.id,
          ct.number,
          clients.name AS clientName
        FROM contracts ct
        INNER JOIN clients ON clients.id = ct.client_id
        ORDER BY clients.name, ct.number
      `)
      .all(),
    employees: db
      .prepare('SELECT id, full_name AS fullName FROM employees ORDER BY full_name')
      .all(),
    priorities: PRIORITY_VALUES.map((value) => ({ value })),
    statuses: db
      .prepare('SELECT id, code, name FROM statuses ORDER BY sort_order')
      .all(),
  };
}

export function createTicket(input) {
  const payload = normalizeTicketPayload(input);
  validateTicketPayload(payload, 'create');

  const result = getDatabase()
    .prepare(`
      INSERT INTO tickets (
        contract_id,
        category_id,
        status_id,
        responsible_employee_id,
        subject,
        description,
        priority,
        deadline
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      payload.contractId,
      payload.categoryId,
      payload.statusId,
      payload.responsibleEmployeeId,
      payload.subject,
      payload.description,
      payload.priority,
      payload.deadlineAt,
    );

  return getTicketById(Number(result.lastInsertRowid));
}

export function updateTicket(id, input) {
  if (!getTicketById(id)) {
    return null;
  }

  const payload = normalizeTicketPayload(input);
  validateTicketPayload(payload, 'update');

  getDatabase()
    .prepare(`
      UPDATE tickets
      SET
        contract_id = ?,
        category_id = ?,
        status_id = ?,
        responsible_employee_id = ?,
        subject = ?,
        description = ?,
        priority = ?,
        deadline = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)
    .run(
      payload.contractId,
      payload.categoryId,
      payload.statusId,
      payload.responsibleEmployeeId,
      payload.subject,
      payload.description,
      payload.priority,
      payload.deadlineAt,
      id,
    );

  return getTicketById(id);
}

export function addWorkLog(ticketId, input) {
  const existingTicket = getTicketById(ticketId);

  if (!existingTicket) {
    return null;
  }

  ensureWorkLogsHoursConstraint();

  const employeeId = toInteger(input.employeeId);
  const workDate = isBlank(input.workDate) ? null : String(input.workDate).trim();
  const description = String(input.description ?? '').trim();
  const hours = toNumber(input.hours);

  if (!employeeId || !workDate || !description || hours === null) {
    throw new Error('Для добавления работы заполните исполнителя, дату, описание и количество часов.');
  }

  if (hours < 0) {
    throw new Error('Количество часов должно быть числом не меньше нуля.');
  }

  if (!getReferenceById('employees', employeeId)) {
    throw new Error('Выбранный исполнитель не найден.');
  }

  getDatabase()
    .prepare(`
      INSERT INTO work_logs (
        ticket_id,
        employee_id,
        work_date,
        description,
        hours
      ) VALUES (?, ?, ?, ?, ?)
    `)
    .run(ticketId, employeeId, workDate, description, hours);

  return getTicketById(ticketId);
}
