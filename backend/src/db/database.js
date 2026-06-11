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

function getNodeMajorVersion() {
  return Number.parseInt(process.versions.node.split('.')[0], 10);
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
      const nodeMajorVersion = getNodeMajorVersion();
      const versionHint =
        nodeMajorVersion >= 24
          ? 'Текущий Node 24+ должен поддерживать node:sqlite, но встроенный модуль недоступен в этой среде.'
          : `Сейчас используется Node ${process.versions.node}. Для fallback через node:sqlite нужен Node 24+.`;

      throw new Error(
        [
          'Не удалось открыть SQLite.',
          versionHint,
          'Варианты исправления:',
          '1. Переключиться на Node 24+ и заново запустить проект.',
          '2. Либо пересобрать better-sqlite3 под текущую версию Node.',
          `better-sqlite3: ${betterSqliteError.message}`,
          `node:sqlite: ${nodeSqliteError.message}`,
        ].join(' '),
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
