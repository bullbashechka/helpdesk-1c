import dotenv from 'dotenv';
import { resolve } from 'node:path';

dotenv.config();

export const config = {
  backendUrl: process.env.BACKEND_URL || 'http://localhost:4000',
  connectorToken: process.env.CONNECTOR_TOKEN || 'dev-connector-token',
  receiverPhone: process.env.RECEIVER_PHONE || '',
  // Номера (только цифры), упоминание которых в группе пропускает сообщение.
  // Несколько — через запятую. Любой формат на входе (+7, пробелы, скобки).
  gemMentionNumbers: (process.env.GEM_MENTION_NUMBERS || '')
    .split(',')
    .map((s) => s.replace(/\D/g, ''))
    .filter(Boolean),
  receiverId: Number(process.env.RECEIVER_ID || 1),
  sessionDir: resolve(process.env.SESSION_DIR || './data/session'),
  queueDir: resolve(process.env.QUEUE_DIR || './data/queue'),
  heartbeatIntervalMs: Number(process.env.HEARTBEAT_INTERVAL_MS || 15_000),
  retryBaseMs: Number(process.env.RETRY_BASE_MS || 2_000),
};
