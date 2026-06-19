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

  db.prepare(
    `INSERT INTO wa_connector_status (receiver_id, state, qr_data_url, last_heartbeat_at, updated_at)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(receiver_id) DO UPDATE SET
       state = excluded.state,
       qr_data_url = excluded.qr_data_url,
       last_heartbeat_at = excluded.last_heartbeat_at,
       updated_at = datetime('now')`,
  ).run(receiverId, state, qr_data_url ?? null, last_heartbeat_at ?? new Date().toISOString());
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
