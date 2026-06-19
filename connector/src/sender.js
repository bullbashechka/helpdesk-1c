import { config } from './config.js';

const INGEST_URL = `${config.backendUrl}/api/whatsapp/ingest`;

export function createSender(queue) {
  let running = false;

  async function flush() {
    if (running) return;
    running = true;
    try {
      const items = queue.list();
      for (const payload of items) {
        await deliverOne(payload);
      }
    } finally {
      running = false;
    }
  }

  async function deliverOne(payload, attempt = 0) {
    try {
      const res = await fetch(INGEST_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Connector-Token': config.connectorToken,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        queue.remove(payload.wa_message_id);
        return;
      }

      // Non-2xx → retry with backoff
      console.warn(`[sender] ingest failed (${res.status}), attempt ${attempt + 1}, will retry`);
    } catch (err) {
      console.warn(`[sender] ingest error (attempt ${attempt + 1}): ${err.message}`);
    }

    const delay = config.retryBaseMs * Math.pow(2, Math.min(attempt, 5));
    setTimeout(() => deliverOne(payload, attempt + 1), delay);
  }

  return { flush };
}
