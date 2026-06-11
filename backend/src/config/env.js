import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

dotenv.config();

const sqliteDbPath = process.env.SQLITE_DB_PATH || './data/helpdesk.sqlite';
const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const env = {
  apiPort: Number(process.env.API_PORT || 4000),
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  sqliteDbPath,
  sqliteDbFile: path.isAbsolute(sqliteDbPath) ? sqliteDbPath : path.resolve(backendRoot, sqliteDbPath),
};
