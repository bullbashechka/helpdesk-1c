import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { env } from '../config/env.js';

let database;
const require = createRequire(import.meta.url);

function getDatabasePath() {
  return resolve(process.cwd(), env.sqliteDbPath);
}

function createDatabase(filePath) {
  try {
    const Database = require('better-sqlite3');
    return new Database(filePath);
  } catch (betterSqliteError) {
    try {
      const { DatabaseSync } = require('node:sqlite');
      return new DatabaseSync(filePath);
    } catch (nodeSqliteError) {
      throw new Error(
        `SQLite driver is unavailable. better-sqlite3: ${betterSqliteError.message}; node:sqlite: ${nodeSqliteError.message}`,
      );
    }
  }
}

export function getDatabase() {
  if (!database) {
    database = createDatabase(getDatabasePath());
    database.exec('PRAGMA foreign_keys = ON');
  }

  return database;
}
