import { getDatabase } from '../db/database.js';

const CLOSED_STATUS_CODE = 'closed';
const RECENT_TICKETS_LIMIT = 8;

function asNumber(value) {
  return Number(value) || 0;
}

function mapCountRow(row) {
  return {
    code: row.code,
    count: asNumber(row.count),
    name: row.name,
  };
}

function mapTicketRow(row) {
  return {
    id: row.id,
    categoryCode: row.categoryCode,
    categoryName: row.categoryName,
    clientName: row.clientName,
    createdAt: row.createdAt,
    deadlineAt: row.deadlineAt,
    statusCode: row.statusCode,
    statusName: row.statusName,
    subject: row.subject,
  };
}

export function getDashboardSummary() {
  const db = getDatabase();

  const totalTickets = db.prepare('SELECT COUNT(*) AS count FROM tickets').get().count;

  const overdueTickets = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM tickets t
      INNER JOIN statuses s ON s.id = t.status_id
      WHERE t.deadline IS NOT NULL
        AND datetime(t.deadline) < datetime('now')
        AND s.code != ?
    `)
    .get(CLOSED_STATUS_CODE).count;

  const statusCounts = db
    .prepare(`
      SELECT s.code, s.name, COUNT(t.id) AS count
      FROM statuses s
      LEFT JOIN tickets t ON t.status_id = s.id
      GROUP BY s.id, s.code, s.name, s.sort_order
      ORDER BY s.sort_order
    `)
    .all()
    .map(mapCountRow);

  const categoryCounts = db
    .prepare(`
      SELECT c.code, c.name, COUNT(t.id) AS count
      FROM categories c
      LEFT JOIN tickets t ON t.category_id = c.id
      GROUP BY c.id, c.code, c.name, c.sort_order
      ORDER BY c.sort_order
    `)
    .all()
    .map(mapCountRow);

  const recentTickets = db
    .prepare(`
      SELECT
        t.id,
        t.subject,
        t.created_at AS createdAt,
        t.deadline AS deadlineAt,
        clients.name AS clientName,
        s.code AS statusCode,
        s.name AS statusName,
        c.code AS categoryCode,
        c.name AS categoryName
      FROM tickets t
      INNER JOIN contracts ct ON ct.id = t.contract_id
      INNER JOIN clients ON clients.id = ct.client_id
      INNER JOIN statuses s ON s.id = t.status_id
      INNER JOIN categories c ON c.id = t.category_id
      ORDER BY datetime(t.created_at) DESC, t.id DESC
      LIMIT ?
    `)
    .all(RECENT_TICKETS_LIMIT)
    .map(mapTicketRow);

  return {
    categories: categoryCounts,
    recentTickets,
    statuses: statusCounts,
    totals: {
      overdueTickets: asNumber(overdueTickets),
      totalTickets: asNumber(totalTickets),
    },
  };
}
