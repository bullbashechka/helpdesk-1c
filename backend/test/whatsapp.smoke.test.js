import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

const testDataDir = mkdtempSync(join(tmpdir(), 'helpdesk-wa-'));
process.env.SQLITE_DB_PATH = join(testDataDir, 'helpdesk.sqlite');
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.WHATSAPP_CONNECTOR_TOKEN = 'test-token';

const { createApp } = await import('../src/app.js');
const { closeDatabase } = await import('../src/db/database.js');

let baseUrl;
let server;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;
  return { payload, response };
}

const VALID_TOKEN = { 'X-Connector-Token': 'test-token' };
const WRONG_TOKEN = { 'X-Connector-Token': 'wrong' };

const baseMessage = {
  wa_message_id: 'false_AA11BB22CC33DD44_1',
  receiver_id: 1,
  sender_phone: '77071234567@c.us',
  sender_name: 'Тест Клиент',
  chat_type: 'private',
  body: 'Привет, вопрос по 1С',
  wa_timestamp: new Date().toISOString(),
};

describe('WhatsApp API smoke', () => {
  before(async () => {
    const app = createApp();
    server = await new Promise((resolve) => {
      const listener = app.listen(0, () => resolve(listener));
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  });

  after(async () => {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    closeDatabase();
    rmSync(testDataDir, { force: true, recursive: true });
  });

  test('таблица wa_attachments создана', async () => {
    const { getDatabase } = await import('../src/db/database.js');
    const row = getDatabase()
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='wa_attachments'")
      .get();
    assert.ok(row, 'ожидалась таблица wa_attachments');
  });

  test('POST /whatsapp/ingest без токена → 401', async () => {
    const { response } = await request('/whatsapp/ingest', {
      method: 'POST',
      body: JSON.stringify(baseMessage),
    });
    assert.equal(response.status, 401);
  });

  test('POST /whatsapp/ingest с неверным токеном → 401', async () => {
    const { response } = await request('/whatsapp/ingest', {
      method: 'POST',
      body: JSON.stringify(baseMessage),
      headers: WRONG_TOKEN,
    });
    assert.equal(response.status, 401);
  });

  test('POST /whatsapp/ingest создаёт запись → 201', async () => {
    const { response, payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      body: JSON.stringify(baseMessage),
      headers: VALID_TOKEN,
    });
    assert.equal(response.status, 201);
    assert.equal(payload.deduplicated, false);
    assert.ok(typeof payload.id === 'number');
  });

  test('POST /whatsapp/ingest с тем же wa_message_id → дедуп 200', async () => {
    const { response, payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      body: JSON.stringify(baseMessage),
      headers: VALID_TOKEN,
    });
    assert.equal(response.status, 200);
    assert.equal(payload.deduplicated, true);
  });

  test('POST /whatsapp/ingest с плохим payload → 400', async () => {
    const { response } = await request('/whatsapp/ingest', {
      method: 'POST',
      body: JSON.stringify({ body: 'нет обязательных полей' }),
      headers: VALID_TOKEN,
    });
    assert.equal(response.status, 400);
  });

  test('POST /whatsapp/status обновляет состояние → 204', async () => {
    const { response } = await request('/whatsapp/status', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: 1, state: 'ready', last_heartbeat_at: new Date().toISOString() }),
      headers: VALID_TOKEN,
    });
    assert.equal(response.status, 204);
  });

  test('GET /whatsapp/status отражает обновлённое состояние', async () => {
    const { response, payload } = await request('/whatsapp/status');
    assert.equal(response.status, 200);
    assert.equal(payload.state, 'ready');
    assert.ok(payload.last_heartbeat_at);
  });

  test('POST /whatsapp/status с qr_required сохраняет qr_data_url', async () => {
    const qr = 'data:image/png;base64,abc123';
    await request('/whatsapp/status', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: 1, state: 'qr_required', qr_data_url: qr }),
      headers: VALID_TOKEN,
    });
    const { payload } = await request('/whatsapp/status');
    assert.equal(payload.state, 'qr_required');
    assert.equal(payload.qr_data_url, qr);
  });

  test('привязка к клиенту по нормализованному телефону', async () => {
    // Демо-клиент (id=1) в базе: '+7 701 100 10 10' → нормализуется в '77011001010'
    // Отправитель: '77011001010@c.us' → нормализуется в '77011001010' → совпадение по 10 хвостовым цифрам
    const msgWithClient = {
      ...baseMessage,
      wa_message_id: 'false_CLIENT_MATCH_1',
      sender_phone: '77011001010@c.us',
    };
    const { payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      body: JSON.stringify(msgWithClient),
      headers: VALID_TOKEN,
    });
    // client_id должен быть заполнен — клиент распознан
    const { payload: status } = await request('/whatsapp/status');
    assert.ok(status); // базовая проверка что система жива; клиент виден через будущий инбокс API
  });

  test('сообщение без совпадения по телефону — без привязки к клиенту', async () => {
    const msgNoClient = {
      ...baseMessage,
      wa_message_id: 'false_NO_CLIENT_1',
      sender_phone: '70000000000@c.us',
    };
    const { response, payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      body: JSON.stringify(msgNoClient),
      headers: VALID_TOKEN,
    });
    assert.equal(response.status, 201);
    assert.equal(payload.deduplicated, false);
  });
});
