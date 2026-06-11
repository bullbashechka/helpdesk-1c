import { getDatabase } from '../db/connection.js';
import { badRequest, notFound } from '../errors/api-error.js';
import { nullableString, parsePositiveId, trimString } from './service-utils.js';

const allowedPriorities = new Set(['low', 'normal', 'high', 'urgent']);

export function listTickets(filters = {}) {
  const params = {};
  const conditions = [];

  if (trimString(filters.search)) {
    params.search = `%${trimString(filters.search)}%`;
    conditions.push('(t.subject LIKE @search OR t.description LIKE @search)');
  }

  if (filters.overdue === 'true' || filters.overdue === true) {
    conditions.push("t.deadline IS NOT NULL AND t.deadline < date('now') AND st.code != 'closed'");
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return getDatabase().prepare(`
    ${ticketSelectSql()}
    ${whereClause}
    ORDER BY t.created_at DESC, t.id DESC
  `).all(params).map(mapTicket);
}

export function getTicket(id) {
  const ticket = getDatabase().prepare(`
    ${ticketSelectSql()}
    WHERE t.id = ?
  `).get(id);

  if (!ticket) {
    throw notFound('Заявка не найдена.');
  }

  return mapTicket(ticket);
}

export function createTicket(payload) {
  const data = normalizeTicketPayload(payload);
  const result = getDatabase().prepare(`
    INSERT INTO tickets (
      contract_id,
      category_id,
      status_id,
      responsible_employee_id,
      subject,
      description,
      priority,
      deadline
    )
    VALUES (
      @contractId,
      @categoryId,
      @statusId,
      @responsibleEmployeeId,
      @subject,
      @description,
      @priority,
      @deadline
    )
  `).run(data);

  return getTicket(result.lastInsertRowid);
}

export function updateTicket(id, payload) {
  getTicket(id);
  const data = normalizeTicketPayload(payload);

  getDatabase().prepare(`
    UPDATE tickets
    SET
      contract_id = @contractId,
      category_id = @categoryId,
      status_id = @statusId,
      responsible_employee_id = @responsibleEmployeeId,
      subject = @subject,
      description = @description,
      priority = @priority,
      deadline = @deadline,
      updated_at = datetime('now')
    WHERE id = @id
  `).run({ ...data, id });

  return getTicket(id);
}

export function deleteTicket(id) {
  getTicket(id);
  getDatabase().prepare('DELETE FROM tickets WHERE id = ?').run(id);
}

function normalizeTicketPayload(payload = {}) {
  const contractId = parsePositiveId(payload.contractId, 'Выберите договор.');
  const categoryId = parsePositiveId(payload.categoryId, 'Выберите категорию заявки.');
  const statusId = parsePositiveId(payload.statusId, 'Выберите статус заявки.');
  const responsibleEmployeeId = parsePositiveId(payload.responsibleEmployeeId, 'Выберите ответственного сотрудника.');
  const subject = trimString(payload.subject);
  const priority = trimString(payload.priority);

  if (!subject) {
    throw badRequest('Укажите тему заявки.');
  }

  if (!priority) {
    throw badRequest('Укажите приоритет заявки.');
  }

  if (!allowedPriorities.has(priority)) {
    throw badRequest('Передан недопустимый приоритет заявки.');
  }

  return {
    contractId,
    categoryId,
    statusId,
    responsibleEmployeeId,
    subject,
    description: nullableString(payload.description),
    priority,
    deadline: nullableString(payload.deadline),
  };
}

function ticketSelectSql() {
  return `
    SELECT
      t.id,
      t.contract_id,
      t.category_id,
      t.status_id,
      t.responsible_employee_id,
      t.subject,
      t.description,
      t.priority,
      t.created_at,
      t.deadline,
      t.updated_at,
      ct.number AS contract_number,
      cl.id AS client_id,
      cl.name AS client_name,
      cat.code AS category_code,
      cat.name AS category_name,
      st.code AS status_code,
      st.name AS status_name,
      emp.full_name AS responsible_employee_name
    FROM tickets t
    JOIN contracts ct ON ct.id = t.contract_id
    JOIN clients cl ON cl.id = ct.client_id
    JOIN categories cat ON cat.id = t.category_id
    JOIN statuses st ON st.id = t.status_id
    JOIN employees emp ON emp.id = t.responsible_employee_id
  `;
}

function mapTicket(row) {
  return {
    id: row.id,
    contractId: row.contract_id,
    categoryId: row.category_id,
    statusId: row.status_id,
    responsibleEmployeeId: row.responsible_employee_id,
    subject: row.subject,
    description: row.description,
    priority: row.priority,
    createdAt: row.created_at,
    deadline: row.deadline,
    updatedAt: row.updated_at,
    isOverdue: Boolean(row.deadline && row.deadline < currentDate() && row.status_code !== 'closed'),
    client: {
      id: row.client_id,
      name: row.client_name,
    },
    contract: {
      id: row.contract_id,
      number: row.contract_number,
    },
    category: {
      id: row.category_id,
      code: row.category_code,
      name: row.category_name,
    },
    status: {
      id: row.status_id,
      code: row.status_code,
      name: row.status_name,
    },
    responsibleEmployee: {
      id: row.responsible_employee_id,
      fullName: row.responsible_employee_name,
    },
  };
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}
