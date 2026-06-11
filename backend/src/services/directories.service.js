import { getDatabase } from '../db/database.js';

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function nullableText(value) {
  return isBlank(value) ? null : String(value).trim();
}

function requiredText(value, fieldName) {
  const normalizedValue = nullableText(value);

  if (!normalizedValue) {
    throw new Error(`Заполните обязательное поле: ${fieldName}.`);
  }

  return normalizedValue;
}

function toInteger(value) {
  const numericValue = Number(value);
  return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

function mapClient(row) {
  if (!row) {
    return null;
  }

  return {
    address: row.address,
    contactName: row.contactPerson,
    contactPerson: row.contactPerson,
    createdAt: row.createdAt,
    email: row.email,
    id: row.id,
    inn: row.taxId,
    name: row.name,
    phone: row.phone,
    taxId: row.taxId,
    updatedAt: row.updatedAt,
  };
}

function mapContract(row) {
  if (!row) {
    return null;
  }

  return {
    clientId: row.clientId,
    clientName: row.clientName,
    createdAt: row.createdAt,
    endDate: row.endDate,
    id: row.id,
    number: row.number,
    startDate: row.startDate,
    supportType: row.supportType,
    tariff: row.tariff,
    updatedAt: row.updatedAt,
  };
}

function mapEmployee(row) {
  if (!row) {
    return null;
  }

  return {
    activeTickets: row.activeTickets ?? 0,
    email: row.email,
    fullName: row.fullName,
    id: row.id,
    name: row.fullName,
    phone: row.phone,
    position: row.position,
    role: row.position,
    updatedAt: row.updatedAt,
    workLogs: row.workLogs ?? 0,
  };
}

function normalizeClient(input) {
  return {
    address: nullableText(input.address),
    contactPerson: nullableText(input.contactPerson ?? input.contactName),
    email: nullableText(input.email),
    name: requiredText(input.name, 'наименование клиента'),
    phone: nullableText(input.phone),
    taxId: nullableText(input.taxId ?? input.inn),
  };
}

function normalizeContract(input) {
  return {
    clientId: toInteger(input.clientId),
    endDate: nullableText(input.endDate),
    number: requiredText(input.number, 'номер договора'),
    startDate: nullableText(input.startDate),
    supportType: nullableText(input.supportType),
    tariff: nullableText(input.tariff),
  };
}

function normalizeEmployee(input) {
  return {
    email: nullableText(input.email),
    fullName: requiredText(input.fullName ?? input.name, 'ФИО сотрудника'),
    phone: nullableText(input.phone),
    position: nullableText(input.position ?? input.role),
  };
}

function getClientRow(id) {
  return getDatabase()
    .prepare(`
      SELECT
        id,
        name,
        tax_id AS taxId,
        contact_person AS contactPerson,
        phone,
        email,
        address,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM clients
      WHERE id = ?
    `)
    .get(id);
}

function getContractRow(id) {
  return getDatabase()
    .prepare(`
      SELECT
        contracts.id,
        contracts.client_id AS clientId,
        clients.name AS clientName,
        contracts.number,
        contracts.start_date AS startDate,
        contracts.end_date AS endDate,
        contracts.support_type AS supportType,
        contracts.tariff,
        contracts.created_at AS createdAt,
        contracts.updated_at AS updatedAt
      FROM contracts
      INNER JOIN clients ON clients.id = contracts.client_id
      WHERE contracts.id = ?
    `)
    .get(id);
}

function getEmployeeRow(id) {
  return getDatabase()
    .prepare(`
      SELECT
        employees.id,
        employees.full_name AS fullName,
        employees.position,
        employees.phone,
        employees.email,
        employees.updated_at AS updatedAt,
        COUNT(DISTINCT tickets.id) AS activeTickets,
        COUNT(DISTINCT work_logs.id) AS workLogs
      FROM employees
      LEFT JOIN tickets ON tickets.responsible_employee_id = employees.id
      LEFT JOIN work_logs ON work_logs.employee_id = employees.id
      WHERE employees.id = ?
      GROUP BY employees.id
    `)
    .get(id);
}

function clientExists(id) {
  return Boolean(getDatabase().prepare('SELECT id FROM clients WHERE id = ?').get(id));
}

export function listClients() {
  return getDatabase()
    .prepare(`
      SELECT
        id,
        name,
        tax_id AS taxId,
        contact_person AS contactPerson,
        phone,
        email,
        address,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM clients
      ORDER BY name
    `)
    .all()
    .map(mapClient);
}

export function getClientById(id) {
  return mapClient(getClientRow(id));
}

export function createClient(input) {
  const payload = normalizeClient(input);
  const result = getDatabase()
    .prepare(`
      INSERT INTO clients (name, tax_id, contact_person, phone, email, address)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      payload.name,
      payload.taxId,
      payload.contactPerson,
      payload.phone,
      payload.email,
      payload.address,
    );

  return getClientById(Number(result.lastInsertRowid));
}

export function updateClient(id, input) {
  if (!getClientById(id)) {
    return null;
  }

  const payload = normalizeClient(input);

  getDatabase()
    .prepare(`
      UPDATE clients
      SET
        name = ?,
        tax_id = ?,
        contact_person = ?,
        phone = ?,
        email = ?,
        address = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)
    .run(
      payload.name,
      payload.taxId,
      payload.contactPerson,
      payload.phone,
      payload.email,
      payload.address,
      id,
    );

  return getClientById(id);
}

export function deleteClient(id) {
  const contractCount = getDatabase()
    .prepare('SELECT COUNT(*) AS count FROM contracts WHERE client_id = ?')
    .get(id)?.count ?? 0;

  if (contractCount > 0) {
    throw new Error('Нельзя удалить клиента: к нему привязаны договоры.');
  }

  const result = getDatabase().prepare('DELETE FROM clients WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listContracts() {
  return getDatabase()
    .prepare(`
      SELECT
        contracts.id,
        contracts.client_id AS clientId,
        clients.name AS clientName,
        contracts.number,
        contracts.start_date AS startDate,
        contracts.end_date AS endDate,
        contracts.support_type AS supportType,
        contracts.tariff,
        contracts.created_at AS createdAt,
        contracts.updated_at AS updatedAt
      FROM contracts
      INNER JOIN clients ON clients.id = contracts.client_id
      ORDER BY clients.name, contracts.number
    `)
    .all()
    .map(mapContract);
}

export function getContractById(id) {
  return mapContract(getContractRow(id));
}

export function createContract(input) {
  const payload = normalizeContract(input);

  if (!payload.clientId || !clientExists(payload.clientId)) {
    throw new Error('Выберите существующего клиента для договора.');
  }

  const result = getDatabase()
    .prepare(`
      INSERT INTO contracts (client_id, number, start_date, end_date, support_type, tariff)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    .run(
      payload.clientId,
      payload.number,
      payload.startDate,
      payload.endDate,
      payload.supportType,
      payload.tariff,
    );

  return getContractById(Number(result.lastInsertRowid));
}

export function updateContract(id, input) {
  if (!getContractById(id)) {
    return null;
  }

  const payload = normalizeContract(input);

  if (!payload.clientId || !clientExists(payload.clientId)) {
    throw new Error('Выберите существующего клиента для договора.');
  }

  getDatabase()
    .prepare(`
      UPDATE contracts
      SET
        client_id = ?,
        number = ?,
        start_date = ?,
        end_date = ?,
        support_type = ?,
        tariff = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)
    .run(
      payload.clientId,
      payload.number,
      payload.startDate,
      payload.endDate,
      payload.supportType,
      payload.tariff,
      id,
    );

  return getContractById(id);
}

export function deleteContract(id) {
  const ticketCount = getDatabase()
    .prepare('SELECT COUNT(*) AS count FROM tickets WHERE contract_id = ?')
    .get(id)?.count ?? 0;

  if (ticketCount > 0) {
    throw new Error('Нельзя удалить договор: по нему есть заявки.');
  }

  const result = getDatabase().prepare('DELETE FROM contracts WHERE id = ?').run(id);
  return result.changes > 0;
}

export function listEmployees() {
  return getDatabase()
    .prepare(`
      SELECT
        employees.id,
        employees.full_name AS fullName,
        employees.position,
        employees.phone,
        employees.email,
        employees.updated_at AS updatedAt,
        COUNT(DISTINCT tickets.id) AS activeTickets,
        COUNT(DISTINCT work_logs.id) AS workLogs
      FROM employees
      LEFT JOIN tickets ON tickets.responsible_employee_id = employees.id
      LEFT JOIN work_logs ON work_logs.employee_id = employees.id
      GROUP BY employees.id
      ORDER BY employees.full_name
    `)
    .all()
    .map(mapEmployee);
}

export function getEmployeeById(id) {
  return mapEmployee(getEmployeeRow(id));
}

export function createEmployee(input) {
  const payload = normalizeEmployee(input);
  const result = getDatabase()
    .prepare(`
      INSERT INTO employees (full_name, position, phone, email)
      VALUES (?, ?, ?, ?)
    `)
    .run(payload.fullName, payload.position, payload.phone, payload.email);

  return getEmployeeById(Number(result.lastInsertRowid));
}

export function updateEmployee(id, input) {
  if (!getEmployeeById(id)) {
    return null;
  }

  const payload = normalizeEmployee(input);

  getDatabase()
    .prepare(`
      UPDATE employees
      SET
        full_name = ?,
        position = ?,
        phone = ?,
        email = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `)
    .run(payload.fullName, payload.position, payload.phone, payload.email, id);

  return getEmployeeById(id);
}

export function deleteEmployee(id) {
  const linkedCounts = getDatabase()
    .prepare(`
      SELECT
        (SELECT COUNT(*) FROM tickets WHERE responsible_employee_id = ?) AS tickets,
        (SELECT COUNT(*) FROM work_logs WHERE employee_id = ?) AS workLogs
    `)
    .get(id, id);

  if ((linkedCounts?.tickets ?? 0) > 0 || (linkedCounts?.workLogs ?? 0) > 0) {
    throw new Error('Нельзя удалить сотрудника: он связан с заявками или работами.');
  }

  const result = getDatabase().prepare('DELETE FROM employees WHERE id = ?').run(id);
  return result.changes > 0;
}
