import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

import { env } from '../config/env.js';
import { initializeDatabase } from './bootstrap.js';

let database;
const require = createRequire(import.meta.url);

function getDatabasePath() {
  return resolve(process.cwd(), env.sqliteDbPath);
}

function createDatabase(filePath) {
  mkdirSync(dirname(filePath), { recursive: true });

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
    initializeDatabase(database);
  }

  return database;
}

export function closeDatabase() {
  if (database) {
    database.close();
    database = null;
  }
}
