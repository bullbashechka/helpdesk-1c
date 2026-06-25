import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

import { env } from '../src/config/env.js';
import { closeDatabase, getDatabase } from '../src/db/database.js';

const databasePath = resolve(process.cwd(), env.sqliteDbPath);

closeDatabase();

if (existsSync(databasePath)) {
  rmSync(databasePath, { force: true });
}

const db = getDatabase();
const summary = db
  .prepare(
    `
      SELECT
        (SELECT COUNT(*) FROM clients) AS clients,
        (SELECT COUNT(*) FROM employees) AS employees,
        (SELECT COUNT(*) FROM contracts) AS contracts,
        (SELECT COUNT(*) FROM tickets) AS tickets,
        (SELECT COUNT(*) FROM work_logs) AS workLogs
    `,
  )
  .get();

console.log(`Demo database recreated: ${databasePath}`);
console.log(JSON.stringify(summary, null, 2));

closeDatabase();
