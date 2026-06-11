import { getDatabase } from '../db/connection.js';

export function listStatuses() {
  return getDatabase().prepare(`
    SELECT id, code, name, sort_order
    FROM statuses
    ORDER BY sort_order
  `).all().map(mapDictionaryItem);
}

export function listCategories() {
  return getDatabase().prepare(`
    SELECT id, code, name, sort_order
    FROM categories
    ORDER BY sort_order
  `).all().map(mapDictionaryItem);
}

function mapDictionaryItem(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    sortOrder: row.sort_order,
  };
}
