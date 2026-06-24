import { existsSync } from 'node:fs';

import { getDatabase } from '../db/database.js';
import { extFromMime, resolveSafePath, storedName, writeAttachmentFile } from './wa-attachments.service.js';
import { phonesMatch } from './phone.js';

function isBlank(v) {
  return v === undefined || v === null || String(v).trim() === '';
}

function findClientByPhone(senderPhone) {
  const clients = getDatabase().prepare('SELECT id, phone FROM clients WHERE phone IS NOT NULL').all();
  const match = clients.find((c) => phonesMatch(c.phone, senderPhone));
  return match ? match.id : null;
}

function saveAttachments(db, messageId, attachments) {
  if (!Array.isArray(attachments)) return;

  const insert = db.prepare(
    `INSERT INTO wa_attachments
      (message_id, kind, availability, original_name, mime_type, size_bytes, stored_path)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  );

  attachments.forEach((att, index) => {
    if (!['photo', 'video', 'document', 'voice'].includes(att?.kind)) return;

    let availability = ['stored', 'too_large', 'failed', 'not_stored'].includes(att.availability)
      ? att.availability
      : 'failed';
    let storedPath = null;

    if (availability === 'stored' && att.data_base64) {
      const name = storedName(messageId, index, extFromMime(att.mime_type, att.original_name));
      try {
        writeAttachmentFile(name, att.data_base64);
        storedPath = name;
      } catch {
        availability = 'failed';
      }
    } else if (availability === 'stored') {
      availability = 'failed';
    }

    insert.run(
      messageId,
      att.kind,
      availability,
      att.original_name ? String(att.original_name) : null,
      att.mime_type ? String(att.mime_type) : null,
      Number.isFinite(att.size_bytes) ? att.size_bytes : null,
      storedPath,
    );
  });
}

export function ingestMessage(payload) {
  const { wa_message_id, receiver_id, sender_phone, sender_name, chat_type, group_name, body, wa_timestamp } =
    payload ?? {};

  if (isBlank(wa_message_id)) throw new Error('Поле wa_message_id обязательно.');
  if (isBlank(sender_phone)) throw new Error('Поле sender_phone обязательно.');
  if (!['private', 'group'].includes(chat_type)) throw new Error('chat_type должен быть private или group.');
  if (isBlank(wa_timestamp)) throw new Error('Поле wa_timestamp обязательно.');

  const db = getDatabase();

  const receiverId = Number(receiver_id) || 1;
  const receiver = db.prepare('SELECT id FROM wa_receivers WHERE id = ?').get(receiverId);
  if (!receiver) throw new Error('Приёмник не найден.');

  const clientId = findClientByPhone(sender_phone);

  const result = db
    .prepare(
      `INSERT INTO wa_messages
        (wa_message_id, receiver_id, sender_phone, sender_name, chat_type, group_name, body, wa_timestamp, client_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(wa_message_id) DO NOTHING`,
    )
    .run(
      String(wa_message_id),
      receiverId,
      String(sender_phone),
      sender_name ? String(sender_name) : null,
      chat_type,
      group_name ? String(group_name) : null,
      body != null ? String(body) : null,
      String(wa_timestamp),
      clientId,
    );

  const deduplicated = result.changes === 0;
  const id = deduplicated
    ? db.prepare('SELECT id FROM wa_messages WHERE wa_message_id = ?').get(String(wa_message_id))?.id ?? null
    : Number(result.lastInsertRowid);

  if (!deduplicated && id) saveAttachments(db, id, payload.attachments);

  return { deduplicated, id };
}

export function upsertConnectorStatus(payload) {
  const { receiver_id, state, qr_data_url, last_heartbeat_at } = payload ?? {};

  if (!['qr_required', 'ready', 'disconnected'].includes(state)) {
    throw new Error('state должен быть qr_required, ready или disconnected.');
  }

  const receiverId = Number(receiver_id) || 1;
  const db = getDatabase();

  const receiver = db.prepare('SELECT id FROM wa_receivers WHERE id = ?').get(receiverId);
  if (!receiver) throw new Error('Приёмник не найден.');

  const before = db
    .prepare('SELECT regenerate_requested FROM wa_connector_status WHERE receiver_id = ?')
    .get(receiverId);
  const wasRequested = (before?.regenerate_requested ?? 0) === 1;

  db.prepare(
    `INSERT INTO wa_connector_status (receiver_id, state, qr_data_url, last_heartbeat_at, regenerate_requested, updated_at)
     VALUES (?, ?, ?, ?, 0, datetime('now'))
     ON CONFLICT(receiver_id) DO UPDATE SET
       state = excluded.state,
       qr_data_url = excluded.qr_data_url,
       last_heartbeat_at = excluded.last_heartbeat_at,
       regenerate_requested = 0,
       updated_at = datetime('now')`,
  ).run(receiverId, state, qr_data_url ?? null, last_heartbeat_at ?? new Date().toISOString());

  return { regenerate_requested: wasRequested };
}

export function requestRegenerate(receiverId = 1) {
  const db = getDatabase();
  db.prepare(
    `INSERT INTO wa_connector_status (receiver_id, state, regenerate_requested, updated_at)
     VALUES (?, 'disconnected', 1, datetime('now'))
     ON CONFLICT(receiver_id) DO UPDATE SET
       regenerate_requested = 1,
       updated_at = datetime('now')`,
  ).run(Number(receiverId));
}

export function getConnectorStatus(receiverId = 1) {
  return getDatabase()
    .prepare('SELECT * FROM wa_connector_status WHERE receiver_id = ?')
    .get(Number(receiverId)) ?? null;
}

export function getAttachmentForDownload(id) {
  const row = getDatabase()
    .prepare("SELECT * FROM wa_attachments WHERE id = ? AND availability = 'stored'")
    .get(Number(id));
  if (!row || !row.stored_path) return null;

  const absPath = resolveSafePath(row.stored_path);
  if (!absPath || !existsSync(absPath)) return null;

  return {
    absPath,
    mime_type: row.mime_type || 'application/octet-stream',
    original_name: row.original_name || `attachment-${id}`,
  };
}

export function getMessageWithAttachments(id) {
  const db = getDatabase();
  const message = db.prepare('SELECT * FROM wa_messages WHERE id = ?').get(Number(id));
  if (!message) return null;

  const attachments = db
    .prepare(
      `SELECT id, kind, availability, original_name, mime_type, size_bytes
       FROM wa_attachments
       WHERE message_id = ?
       ORDER BY id`,
    )
    .all(Number(id));

  return { ...message, attachments };
}

const VALID_STATUSES = new Set(['new', 'in_progress', 'task_created', 'archived']);

export function listMessages({ status, limit = 50, offset = 0 } = {}) {
  const db = getDatabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const filterStatus = VALID_STATUSES.has(status) ? status : null;

  const where = filterStatus ? `WHERE m.processing_status = '${filterStatus}'` : '';

  const rows = db
    .prepare(
      `SELECT
         m.id,
         m.wa_message_id,
         m.sender_phone,
         m.sender_name,
         m.chat_type,
         m.group_name,
         m.body,
         m.wa_timestamp,
         m.created_at,
         m.client_id,
         m.processing_status,
         c.name AS client_name,
         COUNT(a.id) AS attachments_count,
         GROUP_CONCAT(DISTINCT a.kind) AS attachment_kinds
       FROM wa_messages m
       LEFT JOIN clients c ON c.id = m.client_id
       LEFT JOIN wa_attachments a ON a.message_id = m.id
       ${where}
       GROUP BY m.id
       ORDER BY m.wa_timestamp DESC, m.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(safeLimit, safeOffset);

  const total = db
    .prepare(`SELECT COUNT(*) AS cnt FROM wa_messages m ${where}`)
    .get()?.cnt ?? 0;

  return {
    items: rows.map((r) => ({
      id: r.id,
      waMessageId: r.wa_message_id,
      senderPhone: r.sender_phone,
      senderName: r.sender_name,
      chatType: r.chat_type,
      groupName: r.group_name,
      body: r.body,
      waTimestamp: r.wa_timestamp,
      createdAt: r.created_at,
      clientId: r.client_id,
      clientName: r.client_name ?? null,
      processingStatus: r.processing_status,
      attachmentsCount: r.attachments_count ?? 0,
      attachmentKinds: r.attachment_kinds ? r.attachment_kinds.split(',') : [],
    })),
    total,
  };
}

export function getMessagesSummary() {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT processing_status AS status, COUNT(*) AS cnt
       FROM wa_messages
       GROUP BY processing_status`,
    )
    .all();

  const counts = { new: 0, in_progress: 0, task_created: 0, archived: 0, all: 0 };
  for (const row of rows) {
    if (VALID_STATUSES.has(row.status)) {
      counts[row.status] = row.cnt;
    }
    counts.all += row.cnt;
  }
  return { counts };
}

export function archiveMessage(id) {
  const db = getDatabase();
  const msg = db.prepare('SELECT id, processing_status FROM wa_messages WHERE id = ?').get(Number(id));
  if (!msg) throw Object.assign(new Error('Сообщение не найдено.'), { notFound: true });
  if (msg.processing_status !== 'new') {
    throw new Error('Отправить в архив можно только сообщение со статусом «Новое».');
  }
  db.prepare("UPDATE wa_messages SET processing_status = 'archived' WHERE id = ?").run(Number(id));
}

export function unarchiveMessage(id) {
  const db = getDatabase();
  const msg = db.prepare('SELECT id, processing_status FROM wa_messages WHERE id = ?').get(Number(id));
  if (!msg) throw Object.assign(new Error('Сообщение не найдено.'), { notFound: true });
  if (msg.processing_status !== 'archived') {
    throw new Error('Вернуть в инбокс можно только сообщение со статусом «Архив».');
  }
  db.prepare("UPDATE wa_messages SET processing_status = 'new' WHERE id = ?").run(Number(id));
}

const TASK_PRIORITY_VALUES = new Set(['low', 'normal', 'high', 'urgent']);
const TASK_STATUS_VALUES = new Set(['new', 'in_progress', 'done', 'closed']);
const VALID_TASK_STATUSES = new Set(['new', 'in_progress', 'done', 'closed']);

function mapTask(row) {
  if (!row) return null;
  return {
    id: row.id,
    messageId: row.message_id,
    clientId: row.client_id,
    clientName: row.client_name ?? null,
    subject: row.subject,
    description: row.description ?? null,
    priority: row.priority,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createTaskFromMessage(input) {
  const db = getDatabase();

  // Accept both snake_case (API) and camelCase
  const msgId = input.message_id ?? input.messageId;
  const { subject, priority, description } = input;

  const subjectTrimmed = String(subject ?? '').trim();
  if (!subjectTrimmed) throw new Error('Тема задачи обязательна.');
  if (!TASK_PRIORITY_VALUES.has(priority)) throw new Error('Указан некорректный приоритет задачи.');

  const msg = db.prepare('SELECT id, processing_status, client_id FROM wa_messages WHERE id = ?').get(Number(msgId));
  if (!msg) throw Object.assign(new Error('Сообщение не найдено.'), { notFound: true });
  if (msg.processing_status === 'task_created') {
    throw Object.assign(new Error('Из этого сообщения уже создана задача.'), { conflict: true });
  }
  if (msg.processing_status !== 'new') {
    throw new Error('Создать задачу можно только из сообщения со статусом «Новое».');
  }

  const descTrimmed = description != null ? String(description).trim() || null : null;

  // Портативная транзакция через BEGIN/COMMIT: метод db.transaction() есть только
  // у better-sqlite3, но не у fallback node:sqlite (DatabaseSync). Оба движка
  // поддерживают exec('BEGIN'/'COMMIT'/'ROLLBACK').
  let newId;
  db.exec('BEGIN');
  try {
    const result = db
      .prepare(
        `INSERT INTO wa_tasks (message_id, client_id, subject, description, priority)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(Number(msg.id), msg.client_id, subjectTrimmed, descTrimmed, priority);
    db.prepare("UPDATE wa_messages SET processing_status = 'task_created' WHERE id = ?").run(Number(msg.id));
    newId = Number(result.lastInsertRowid);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }

  return getTaskById(newId);
}

export function getTaskById(id) {
  const db = getDatabase();
  const row = db
    .prepare(
      `SELECT t.*, c.name AS client_name
       FROM wa_tasks t
       LEFT JOIN clients c ON c.id = t.client_id
       WHERE t.id = ?`,
    )
    .get(Number(id));
  if (!row) return null;

  const task = mapTask(row);

  const message = db.prepare('SELECT * FROM wa_messages WHERE id = ?').get(row.message_id);
  const attachments = db
    .prepare(
      `SELECT id, kind, availability, original_name, mime_type, size_bytes
       FROM wa_attachments WHERE message_id = ? ORDER BY id`,
    )
    .all(row.message_id);

  task.message = message ? { ...message, attachments } : null;
  return task;
}

export function updateTask(id, { subject, priority, description, status }) {
  const db = getDatabase();

  const subjectTrimmed = String(subject ?? '').trim();
  if (!subjectTrimmed) throw new Error('Тема задачи обязательна.');
  if (!TASK_PRIORITY_VALUES.has(priority)) throw new Error('Указан некорректный приоритет задачи.');
  if (!TASK_STATUS_VALUES.has(status)) throw new Error('Указан некорректный статус задачи.');

  const existing = db.prepare('SELECT id FROM wa_tasks WHERE id = ?').get(Number(id));
  if (!existing) return null;

  const descTrimmed = description != null ? String(description).trim() || null : null;

  db.prepare(
    `UPDATE wa_tasks
     SET subject = ?, description = ?, priority = ?, status = ?, updated_at = datetime('now')
     WHERE id = ?`,
  ).run(subjectTrimmed, descTrimmed, priority, status, Number(id));

  return getTaskById(Number(id));
}

export function listTasks({ status, limit = 50, offset = 0 } = {}) {
  const db = getDatabase();
  const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const filterStatus = VALID_TASK_STATUSES.has(status) ? status : null;

  const where = filterStatus ? `WHERE t.status = '${filterStatus}'` : '';

  const rows = db
    .prepare(
      `SELECT
         t.id, t.message_id, t.client_id, t.subject, t.description,
         t.priority, t.status, t.created_at, t.updated_at,
         c.name AS client_name,
         m.sender_name, m.sender_phone, m.wa_timestamp
       FROM wa_tasks t
       LEFT JOIN clients c ON c.id = t.client_id
       LEFT JOIN wa_messages m ON m.id = t.message_id
       ${where}
       ORDER BY t.created_at DESC, t.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(safeLimit, safeOffset);

  const total = db.prepare(`SELECT COUNT(*) AS cnt FROM wa_tasks t ${where}`).get()?.cnt ?? 0;

  return {
    items: rows.map((r) => ({
      id: r.id,
      messageId: r.message_id,
      clientId: r.client_id,
      clientName: r.client_name ?? null,
      subject: r.subject,
      description: r.description ?? null,
      priority: r.priority,
      status: r.status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      senderName: r.sender_name ?? null,
      senderPhone: r.sender_phone ?? null,
      waTimestamp: r.wa_timestamp ?? null,
    })),
    total,
  };
}

export function getTasksSummary() {
  const db = getDatabase();
  const rows = db
    .prepare(
      `SELECT status, COUNT(*) AS cnt FROM wa_tasks GROUP BY status`,
    )
    .all();

  const counts = { new: 0, in_progress: 0, done: 0, closed: 0, all: 0 };
  for (const row of rows) {
    if (VALID_TASK_STATUSES.has(row.status)) counts[row.status] = row.cnt;
    counts.all += row.cnt;
  }
  return { counts };
}
