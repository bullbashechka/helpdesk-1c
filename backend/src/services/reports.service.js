import { getDatabase } from '../db/database.js';

function normalizeDate(value) {
  if (!value) {
    return '';
  }

  return String(value).trim();
}

function buildDateRangeCondition(columnName, { dateFrom = '', dateTo = '' } = {}) {
  const conditions = [];
  const parameters = [];

  if (dateFrom) {
    conditions.push(`date(${columnName}) >= date(?)`);
    parameters.push(dateFrom);
  }

  if (dateTo) {
    conditions.push(`date(${columnName}) <= date(?)`);
    parameters.push(dateTo);
  }

  return {
    parameters,
    whereClause: conditions.length ? `WHERE ${conditions.join(' AND ')}` : '',
  };
}

export function getTicketsReport({ dateFrom = '', dateTo = '' } = {}) {
  const normalizedRange = {
    dateFrom: normalizeDate(dateFrom),
    dateTo: normalizeDate(dateTo),
  };
  const { parameters, whereClause } = buildDateRangeCondition('t.created_at', normalizedRange);

  const items = getDatabase()
    .prepare(`
      SELECT
        t.id,
        t.subject,
        t.priority,
        t.created_at AS createdAt,
        t.deadline AS deadlineAt,
        clients.name AS clientName,
        ct.number AS contractNumber,
        categories.name AS categoryName,
        statuses.name AS statusName,
        employees.full_name AS assigneeName,
        COALESCE(SUM(work_logs.hours), 0) AS spentHours
      FROM tickets t
      INNER JOIN contracts ct ON ct.id = t.contract_id
      INNER JOIN clients ON clients.id = ct.client_id
      INNER JOIN categories ON categories.id = t.category_id
      INNER JOIN statuses ON statuses.id = t.status_id
      INNER JOIN employees ON employees.id = t.responsible_employee_id
      LEFT JOIN work_logs ON work_logs.ticket_id = t.id
      ${whereClause}
      GROUP BY
        t.id,
        t.subject,
        t.priority,
        t.created_at,
        t.deadline,
        clients.name,
        ct.number,
        categories.name,
        statuses.name,
        employees.full_name
      ORDER BY datetime(t.created_at) DESC, t.id DESC
    `)
    .all(...parameters)
    .map((row) => ({
      assigneeName: row.assigneeName,
      categoryName: row.categoryName,
      clientName: row.clientName,
      contractNumber: row.contractNumber,
      createdAt: row.createdAt,
      deadlineAt: row.deadlineAt,
      id: row.id,
      number: `#${row.id}`,
      priority: row.priority,
      spentHours: Number(row.spentHours) || 0,
      statusName: row.statusName,
      subject: row.subject,
    }));

  return {
    filters: normalizedRange,
    items,
  };
}

export function getEmployeeHoursReport({ dateFrom = '', dateTo = '' } = {}) {
  const normalizedRange = {
    dateFrom: normalizeDate(dateFrom),
    dateTo: normalizeDate(dateTo),
  };
  const { parameters, whereClause } = buildDateRangeCondition('work_logs.work_date', normalizedRange);

  const items = getDatabase()
    .prepare(`
      SELECT
        employees.id,
        employees.full_name AS employeeName,
        employees.position,
        COUNT(work_logs.id) AS workLogsCount,
        COALESCE(SUM(work_logs.hours), 0) AS totalHours
      FROM employees
      LEFT JOIN work_logs ON work_logs.employee_id = employees.id
      ${whereClause}
      GROUP BY employees.id, employees.full_name, employees.position
      HAVING COUNT(work_logs.id) > 0 OR (? = '' AND ? = '')
      ORDER BY totalHours DESC, employeeName ASC
    `)
    .all(...parameters, normalizedRange.dateFrom, normalizedRange.dateTo)
    .map((row) => ({
      employeeName: row.employeeName,
      id: row.id,
      position: row.position,
      totalHours: Number(row.totalHours) || 0,
      workLogsCount: Number(row.workLogsCount) || 0,
    }));

  return {
    filters: normalizedRange,
    items,
  };
}
