import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

import { env } from '../config/env.js';

let database;

export function getDatabase() {
  if (!database) {
    fs.mkdirSync(path.dirname(env.sqliteDbFile), { recursive: true });
    database = new Database(env.sqliteDbFile);
    database.pragma('foreign_keys = ON');
  }

  return database;
}
