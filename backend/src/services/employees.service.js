import { getDatabase } from '../db/connection.js';
import { badRequest, notFound } from '../errors/api-error.js';

export function listEmployees() {
  return getDatabase().prepare(`
    SELECT id, full_name, position, phone, email, created_at, updated_at
    FROM employees
    ORDER BY full_name
  `).all().map(mapEmployee);
}

export function getEmployee(id) {
  const employee = getDatabase().prepare(`
    SELECT id, full_name, position, phone, email, created_at, updated_at
    FROM employees
    WHERE id = ?
  `).get(id);

  if (!employee) {
    throw notFound('Сотрудник не найден.');
  }

  return mapEmployee(employee);
}

export function createEmployee(payload) {
  const data = normalizeEmployeePayload(payload);
  const result = getDatabase().prepare(`
    INSERT INTO employees (full_name, position, phone, email)
    VALUES (@fullName, @position, @phone, @email)
  `).run(data);

  return getEmployee(result.lastInsertRowid);
}

export function updateEmployee(id, payload) {
  getEmployee(id);
  const data = normalizeEmployeePayload(payload);

  getDatabase().prepare(`
    UPDATE employees
    SET
      full_name = @fullName,
      position = @position,
      phone = @phone,
      email = @email,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...data, id });

  return getEmployee(id);
}

export function deleteEmployee(id) {
  getEmployee(id);
  getDatabase().prepare('DELETE FROM employees WHERE id = ?').run(id);
}

function normalizeEmployeePayload(payload = {}) {
  const fullName = trimString(payload.fullName);

  if (!fullName) {
    throw badRequest('Укажите ФИО сотрудника.');
  }

  return {
    fullName,
    position: nullableString(payload.position),
    phone: nullableString(payload.phone),
    email: nullableString(payload.email),
  };
}

function mapEmployee(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    position: row.position,
    phone: row.phone,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function trimString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value) {
  const trimmed = trimString(value);
  return trimmed || null;
}
