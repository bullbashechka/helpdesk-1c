import { env } from '../config/env.js';

export function getHealth() {
  return {
    status: 'ok',
    service: 'helpdesk-1c-api',
    timestamp: new Date().toISOString(),
    sqliteDbPath: env.sqliteDbPath,
  };
}
