import { fileURLToPath } from 'node:url';

import { getDatabase } from './connection.js';
import { seedDatabase } from './seed.js';
import { createSchema } from './schema.js';

export function initializeDatabase() {
  const db = getDatabase();

  db.transaction(() => {
    createSchema(db);
    seedDatabase(db);
  })();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeDatabase();
  console.log('SQLite database initialized');
}
