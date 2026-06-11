import { getTicket } from './tickets.service.js';
import { getDatabase } from '../db/connection.js';
import { badRequest, notFound } from '../errors/api-error.js';
import { nullableString, parsePositiveId, trimString } from './service-utils.js';

export function listTicketWorkLogs(ticketId) {
  getTicket(ticketId);

  return getDatabase().prepare(`
    SELECT
      wl.id,
      wl.ticket_id,
      wl.employee_id,
      wl.work_date,
      wl.description,
      wl.hours,
      wl.created_at,
      e.full_name AS employee_name
    FROM work_logs wl
    JOIN employees e ON e.id = wl.employee_id
    WHERE wl.ticket_id = ?
    ORDER BY wl.work_date DESC, wl.id DESC
  `).all(ticketId).map(mapWorkLog);
}

export function createTicketWorkLog(ticketId, payload) {
  getTicket(ticketId);
  const data = normalizeWorkLogPayload(ticketId, payload);

  const result = getDatabase().prepare(`
    INSERT INTO work_logs (ticket_id, employee_id, work_date, description, hours)
    VALUES (@ticketId, @employeeId, COALESCE(@workDate, date('now')), @description, @hours)
  `).run(data);

  return getWorkLog(result.lastInsertRowid);
}

function getWorkLog(id) {
  const workLog = getDatabase().prepare(`
    SELECT
      wl.id,
      wl.ticket_id,
      wl.employee_id,
      wl.work_date,
      wl.description,
      wl.hours,
      wl.created_at,
      e.full_name AS employee_name
    FROM work_logs wl
    JOIN employees e ON e.id = wl.employee_id
    WHERE wl.id = ?
  `).get(id);

  if (!workLog) {
    throw notFound('Запись о работе не найдена.');
  }

  return mapWorkLog(workLog);
}

function normalizeWorkLogPayload(ticketId, payload = {}) {
  const employeeId = parsePositiveId(payload.employeeId, 'Выберите сотрудника для записи о работе.');
  const description = trimString(payload.description);
  const hours = Number(payload.hours);

  if (!description) {
    throw badRequest('Укажите описание выполненной работы.');
  }

  if (!Number.isFinite(hours) || hours <= 0) {
    throw badRequest('Укажите положительное количество часов.');
  }

  return {
    ticketId: parsePositiveId(ticketId, 'Некорректный идентификатор заявки.'),
    employeeId,
    workDate: nullableString(payload.workDate),
    description,
    hours,
  };
}

function mapWorkLog(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    employeeId: row.employee_id,
    workDate: row.work_date,
    description: row.description,
    hours: row.hours,
    createdAt: row.created_at,
    employee: {
      id: row.employee_id,
      fullName: row.employee_name,
    },
  };
}
