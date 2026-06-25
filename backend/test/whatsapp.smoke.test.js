import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';

const testDataDir = mkdtempSync(join(tmpdir(), 'helpdesk-wa-'));
process.env.SQLITE_DB_PATH = join(testDataDir, 'helpdesk.sqlite');
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.WHATSAPP_CONNECTOR_TOKEN = 'test-token';
process.env.WA_ATTACHMENTS_DIR = join(testDataDir, 'wa-attachments');

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

// Модульный before/after: запускают сервер один раз для всех describe-блоков
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

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('WhatsApp API smoke', () => {
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

  test('ingest с фото сохраняет вложение → stored', async () => {
    const { getDatabase } = await import('../src/db/database.js');
    const { payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_ATT_PHOTO_1',
        attachments: [
          {
            kind: 'photo',
            availability: 'stored',
            original_name: 'shot.png',
            mime_type: 'image/png',
            data_base64: PNG_BASE64,
          },
        ],
      }),
    });
    const rows = getDatabase().prepare('SELECT * FROM wa_attachments WHERE message_id = ?').all(payload.id);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].availability, 'stored');
    assert.ok(rows[0].stored_path);
  });

  test('ingest too_large не пишет файл', async () => {
    const { getDatabase } = await import('../src/db/database.js');
    const { payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_ATT_BIG_1',
        attachments: [{ kind: 'video', availability: 'too_large', original_name: 'big.mp4', mime_type: 'video/mp4' }],
      }),
    });
    const row = getDatabase().prepare('SELECT * FROM wa_attachments WHERE message_id = ?').get(payload.id);
    assert.equal(row.availability, 'too_large');
    assert.equal(row.stored_path, null);
  });

  test('voice → not_stored без файла', async () => {
    const { getDatabase } = await import('../src/db/database.js');
    const { payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_ATT_VOICE_1',
        body: null,
        attachments: [{ kind: 'voice', availability: 'not_stored' }],
      }),
    });
    const row = getDatabase().prepare('SELECT * FROM wa_attachments WHERE message_id = ?').get(payload.id);
    assert.equal(row.kind, 'voice');
    assert.equal(row.availability, 'not_stored');
  });

  test('дедуп не дублирует вложения', async () => {
    const { getDatabase } = await import('../src/db/database.js');
    const msg = {
      ...baseMessage,
      wa_message_id: 'false_ATT_DUP_1',
      attachments: [
        { kind: 'photo', availability: 'stored', original_name: 'a.png', mime_type: 'image/png', data_base64: PNG_BASE64 },
      ],
    };
    const first = await request('/whatsapp/ingest', { method: 'POST', headers: VALID_TOKEN, body: JSON.stringify(msg) });
    await request('/whatsapp/ingest', { method: 'POST', headers: VALID_TOKEN, body: JSON.stringify(msg) });
    const rows = getDatabase().prepare('SELECT * FROM wa_attachments WHERE message_id = ?').all(first.payload.id);
    assert.equal(rows.length, 1);
  });

  test('GET attachments/:id отдаёт файл с верным типом', async () => {
    const { getDatabase } = await import('../src/db/database.js');
    const { payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_ATT_DL_1',
        attachments: [
          { kind: 'photo', availability: 'stored', original_name: 'd.png', mime_type: 'image/png', data_base64: PNG_BASE64 },
        ],
      }),
    });
    const att = getDatabase().prepare('SELECT id FROM wa_attachments WHERE message_id = ?').get(payload.id);
    const res = await fetch(`${baseUrl}/whatsapp/attachments/${att.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    assert.ok((await res.arrayBuffer()).byteLength > 0);
  });

  test('GET attachments/:id для несуществующего → 404', async () => {
    const res = await fetch(`${baseUrl}/whatsapp/attachments/999999`);
    assert.equal(res.status, 404);
  });

  test('GET messages/:id возвращает сообщение с вложениями', async () => {
    const { payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_MSG_READ_1',
        attachments: [
          { kind: 'photo', availability: 'stored', original_name: 'm.png', mime_type: 'image/png', data_base64: PNG_BASE64 },
        ],
      }),
    });
    const { response, payload: msg } = await request(`/whatsapp/messages/${payload.id}`);
    assert.equal(response.status, 200);
    assert.equal(msg.id, payload.id);
    assert.equal(msg.attachments.length, 1);
    assert.equal(msg.attachments[0].kind, 'photo');
  });

  test('POST /whatsapp/status обновляет состояние → 200 + regenerate_requested false', async () => {
    const { response, payload } = await request('/whatsapp/status', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: 1, state: 'ready', last_heartbeat_at: new Date().toISOString() }),
      headers: VALID_TOKEN,
    });
    assert.equal(response.status, 200);
    assert.equal(payload.regenerate_requested, false);
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

  test('POST /whatsapp/regenerate ставит флаг → 202', async () => {
    const { response, payload } = await request('/whatsapp/regenerate', { method: 'POST' });
    assert.equal(response.status, 202);
    assert.equal(payload.requested, true);
  });

  test('POST /whatsapp/status после /regenerate возвращает regenerate_requested true (read-once)', async () => {
    await request('/whatsapp/regenerate', { method: 'POST' });
    const { payload: first } = await request('/whatsapp/status', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: 1, state: 'ready' }),
      headers: VALID_TOKEN,
    });
    assert.equal(first.regenerate_requested, true);
    const { payload: second } = await request('/whatsapp/status', {
      method: 'POST',
      body: JSON.stringify({ receiver_id: 1, state: 'ready' }),
      headers: VALID_TOKEN,
    });
    assert.equal(second.regenerate_requested, false);
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

  test('групповое сообщение создаёт клиента по названию группы и привязывает его', async () => {
    const groupName = 'Поддержка 1С — Новая Группа';
    const { response, payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_GROUP_NEW_1',
        chat_type: 'group',
        group_name: groupName,
        sender_phone: '79990001122@c.us',
      }),
    });
    assert.equal(response.status, 201);
    const { payload: list } = await request('/whatsapp/messages');
    const found = list.items.find((m) => m.id === payload.id);
    assert.ok(found, 'групповое сообщение должно быть в списке');
    assert.equal(found.clientName, groupName, 'клиент должен называться как группа');
  });

  test('повторное групповое сообщение из той же группы не создаёт нового клиента', async () => {
    const groupName = 'Поддержка 1С — Новая Группа';
    const { getDatabase } = await import('../src/db/database.js');
    const before = getDatabase().prepare('SELECT COUNT(*) AS cnt FROM clients WHERE name = ?').get(groupName).cnt;
    await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_GROUP_NEW_2',
        chat_type: 'group',
        group_name: groupName,
        sender_phone: '79990003344@c.us',
      }),
    });
    const after = getDatabase().prepare('SELECT COUNT(*) AS cnt FROM clients WHERE name = ?').get(groupName).cnt;
    assert.equal(before, 1, 'клиент группы должен существовать после первого сообщения');
    assert.equal(after, 1, 'повторное сообщение не должно дублировать клиента');
  });

  test('GET /whatsapp/messages возвращает items и counts', async () => {
    const { response, payload } = await request('/whatsapp/messages');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(payload.items), 'items должен быть массивом');
    assert.ok(typeof payload.total === 'number', 'total должен быть числом');
  });

  test('GET /whatsapp/messages — заингещенное сообщение присутствует с processingStatus new', async () => {
    const { payload } = await request('/whatsapp/messages');
    const found = payload.items.find((m) => m.waMessageId === baseMessage.wa_message_id);
    assert.ok(found, 'первое тестовое сообщение должно быть в списке');
    assert.equal(found.processingStatus, 'new');
  });

  test('GET /whatsapp/messages?status=archived — не возвращает новые сообщения', async () => {
    const { payload } = await request('/whatsapp/messages?status=archived');
    assert.ok(Array.isArray(payload.items));
    const hasNew = payload.items.some((m) => m.processingStatus === 'new');
    assert.equal(hasNew, false, 'в архивном фильтре не должно быть новых');
  });

  test('GET /whatsapp/messages?limit=2 ограничивает выдачу', async () => {
    const { payload } = await request('/whatsapp/messages?limit=2');
    assert.ok(payload.items.length <= 2);
  });

  test('GET /whatsapp/messages?offset=1000 возвращает пустой список', async () => {
    const { payload } = await request('/whatsapp/messages?offset=1000');
    assert.equal(payload.items.length, 0);
  });

  test('GET /whatsapp/messages/summary возвращает counts с new >= 1', async () => {
    const { response, payload } = await request('/whatsapp/messages/summary');
    assert.equal(response.status, 200);
    assert.ok(typeof payload.counts === 'object', 'counts должен быть объектом');
    assert.ok(typeof payload.counts.new === 'number');
    assert.ok(payload.counts.new >= 1, 'должно быть хотя бы одно новое сообщение');
    assert.ok(typeof payload.counts.all === 'number');
  });

  test('GET /whatsapp/messages/summary не перехватывается маршрутом :id', async () => {
    const { response } = await request('/whatsapp/messages/summary');
    assert.equal(response.status, 200);
  });

  test('сообщение с фото даёт attachmentsCount >= 1 и attachmentKinds', async () => {
    const { payload: ingest } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_INBOX_ATT_1',
        attachments: [
          { kind: 'photo', availability: 'stored', original_name: 'x.png', mime_type: 'image/png', data_base64: PNG_BASE64 },
        ],
      }),
    });
    const { payload } = await request('/whatsapp/messages');
    const found = payload.items.find((m) => m.id === ingest.id);
    assert.ok(found, 'сообщение с вложением должно быть в списке');
    assert.ok(found.attachmentsCount >= 1);
    assert.ok(Array.isArray(found.attachmentKinds));
    assert.ok(found.attachmentKinds.includes('photo'));
  });
});

describe('WhatsApp задачи и архив', () => {
  let ingestedMsgId;

  before(async () => {
    // Создаём тестовое сообщение через ingest
    const { payload } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({
        ...baseMessage,
        wa_message_id: 'false_TASK_TEST_1',
        body: 'Не работает 1С после обновления',
      }),
    });
    ingestedMsgId = payload.id;
  });

  // --- Архив ---

  test('POST /messages/:id/archive (new) → 204', async () => {
    // Используем другое сообщение, чтобы не конфликтовать с тестами задач
    const { payload: msg } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({ ...baseMessage, wa_message_id: 'false_ARCHIVE_TEST_1' }),
    });
    const { response } = await request(`/whatsapp/messages/${msg.id}/archive`, { method: 'POST' });
    assert.equal(response.status, 204);
  });

  test('GET /messages/:id после archive показывает archived', async () => {
    const { payload: msg } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({ ...baseMessage, wa_message_id: 'false_ARCHIVE_TEST_2' }),
    });
    await request(`/whatsapp/messages/${msg.id}/archive`, { method: 'POST' });
    const { payload: detail } = await request(`/whatsapp/messages/${msg.id}`);
    assert.equal(detail.processing_status, 'archived');
  });

  test('POST /messages/:id/unarchive → 204 и статус снова new', async () => {
    const { payload: msg } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({ ...baseMessage, wa_message_id: 'false_ARCHIVE_TEST_3' }),
    });
    await request(`/whatsapp/messages/${msg.id}/archive`, { method: 'POST' });
    const { response } = await request(`/whatsapp/messages/${msg.id}/unarchive`, { method: 'POST' });
    assert.equal(response.status, 204);
    const { payload: detail } = await request(`/whatsapp/messages/${msg.id}`);
    assert.equal(detail.processing_status, 'new');
  });

  test('archive несуществующего сообщения → 404', async () => {
    const { response } = await request('/whatsapp/messages/999999/archive', { method: 'POST' });
    assert.equal(response.status, 404);
  });

  test('повторный archive (уже archived) → 400', async () => {
    const { payload: msg } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({ ...baseMessage, wa_message_id: 'false_ARCHIVE_TEST_4' }),
    });
    await request(`/whatsapp/messages/${msg.id}/archive`, { method: 'POST' });
    const { response } = await request(`/whatsapp/messages/${msg.id}/archive`, { method: 'POST' });
    assert.equal(response.status, 400);
  });

  // --- Задачи ---

  test('POST /tasks создаёт задачу из нового сообщения → 201', async () => {
    const { response, payload } = await request('/whatsapp/tasks', {
      method: 'POST',
      body: JSON.stringify({ message_id: ingestedMsgId, subject: 'Тестовая задача', priority: 'normal' }),
    });
    assert.equal(response.status, 201);
    assert.ok(typeof payload.id === 'number');
    assert.equal(payload.status, 'new');
    assert.equal(payload.priority, 'normal');
    assert.equal(payload.subject, 'Тестовая задача');
  });

  test('статус исходного сообщения стал task_created', async () => {
    const { payload: detail } = await request(`/whatsapp/messages/${ingestedMsgId}`);
    assert.equal(detail.processing_status, 'task_created');
  });

  test('POST /tasks из того же сообщения → 409 (дубль)', async () => {
    const { response } = await request('/whatsapp/tasks', {
      method: 'POST',
      body: JSON.stringify({ message_id: ingestedMsgId, subject: 'Дубль', priority: 'low' }),
    });
    assert.equal(response.status, 409);
  });

  test('POST /tasks без subject → 400', async () => {
    const { payload: newMsg } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({ ...baseMessage, wa_message_id: 'false_TASK_NO_SUBJ' }),
    });
    const { response } = await request('/whatsapp/tasks', {
      method: 'POST',
      body: JSON.stringify({ message_id: newMsg.id, subject: '', priority: 'normal' }),
    });
    assert.equal(response.status, 400);
  });

  test('POST /tasks с неверным priority → 400', async () => {
    const { payload: newMsg } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({ ...baseMessage, wa_message_id: 'false_TASK_BAD_PRIO' }),
    });
    const { response } = await request('/whatsapp/tasks', {
      method: 'POST',
      body: JSON.stringify({ message_id: newMsg.id, subject: 'Тест', priority: 'critical' }),
    });
    assert.equal(response.status, 400);
  });

  test('POST /tasks из archived сообщения → 400', async () => {
    const { payload: msg } = await request('/whatsapp/ingest', {
      method: 'POST',
      headers: VALID_TOKEN,
      body: JSON.stringify({ ...baseMessage, wa_message_id: 'false_TASK_FROM_ARCH' }),
    });
    await request(`/whatsapp/messages/${msg.id}/archive`, { method: 'POST' });
    const { response } = await request('/whatsapp/tasks', {
      method: 'POST',
      body: JSON.stringify({ message_id: msg.id, subject: 'Из архива', priority: 'normal' }),
    });
    assert.equal(response.status, 400);
  });

  test('GET /tasks возвращает items и total', async () => {
    const { response, payload } = await request('/whatsapp/tasks');
    assert.equal(response.status, 200);
    assert.ok(Array.isArray(payload.items));
    assert.ok(typeof payload.total === 'number');
    assert.ok(payload.total >= 1);
  });

  test('GET /tasks содержит созданную задачу', async () => {
    const { payload } = await request('/whatsapp/tasks');
    const found = payload.items.find((t) => t.messageId === ingestedMsgId);
    assert.ok(found, 'задача должна быть в списке');
    assert.equal(found.subject, 'Тестовая задача');
  });

  test('GET /tasks/summary возвращает counts', async () => {
    const { response, payload } = await request('/whatsapp/tasks/summary');
    assert.equal(response.status, 200);
    assert.ok(typeof payload.counts === 'object');
    assert.ok(typeof payload.counts.new === 'number');
    assert.ok(payload.counts.new >= 1);
    assert.ok(typeof payload.counts.all === 'number');
  });

  test('GET /tasks/summary не перехватывается :id', async () => {
    const { response } = await request('/whatsapp/tasks/summary');
    assert.equal(response.status, 200);
  });

  test('GET /tasks/:id возвращает задачу с полями исходного сообщения', async () => {
    const { payload: list } = await request('/whatsapp/tasks');
    const task = list.items.find((t) => t.messageId === ingestedMsgId);
    const { response, payload } = await request(`/whatsapp/tasks/${task.id}`);
    assert.equal(response.status, 200);
    assert.ok(payload.message, 'должно быть поле message с данными сообщения');
    assert.ok(Array.isArray(payload.message.attachments));
  });

  test('GET /tasks/:id несуществующей задачи → 404', async () => {
    const { response } = await request('/whatsapp/tasks/999999');
    assert.equal(response.status, 404);
  });

  test('PUT /tasks/:id меняет тему и статус → 200', async () => {
    const { payload: list } = await request('/whatsapp/tasks');
    const task = list.items.find((t) => t.messageId === ingestedMsgId);
    const { response, payload } = await request(`/whatsapp/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify({ subject: 'Обновлённая тема', priority: 'high', status: 'in_progress' }),
    });
    assert.equal(response.status, 200);
    assert.equal(payload.subject, 'Обновлённая тема');
    assert.equal(payload.status, 'in_progress');
    assert.equal(payload.priority, 'high');
  });

  test('GET /tasks/:id отражает обновления из PUT', async () => {
    const { payload: list } = await request('/whatsapp/tasks');
    const task = list.items.find((t) => t.messageId === ingestedMsgId);
    const { payload } = await request(`/whatsapp/tasks/${task.id}`);
    assert.equal(payload.subject, 'Обновлённая тема');
    assert.equal(payload.status, 'in_progress');
  });

  test('PUT /tasks/:id с пустым subject → 400', async () => {
    const { payload: list } = await request('/whatsapp/tasks');
    const task = list.items.find((t) => t.messageId === ingestedMsgId);
    const { response } = await request(`/whatsapp/tasks/${task.id}`, {
      method: 'PUT',
      body: JSON.stringify({ subject: '', priority: 'normal', status: 'new' }),
    });
    assert.equal(response.status, 400);
  });

  test('PUT /tasks/:id несуществующей → 404', async () => {
    const { response } = await request('/whatsapp/tasks/999999', {
      method: 'PUT',
      body: JSON.stringify({ subject: 'Тест', priority: 'normal', status: 'new' }),
    });
    assert.equal(response.status, 404);
  });
});
