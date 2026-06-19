import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

import { config } from './config.js';
import { availabilityForSize, base64Bytes, classifyMedia } from './media.js';

// Persist first-auth timestamp so messages older than it are ignored on reconnect.
function loadFirstAuthAt(sessionDir) {
  const file = join(sessionDir, 'first_auth_at.json');
  try {
    return JSON.parse(readFileSync(file, 'utf8')).ts;
  } catch {
    return null;
  }
}

function saveFirstAuthAt(sessionDir, ts) {
  mkdirSync(sessionDir, { recursive: true });
  const file = join(sessionDir, 'first_auth_at.json');
  if (!existsSync(file)) {
    writeFileSync(file, JSON.stringify({ ts }), 'utf8');
  }
}

function normalizeJid(jid) {
  if (!jid) return '';
  return jid.includes('@') ? jid.split('@')[0] : jid;
}

function isGroupChat(msg) {
  return msg.from?.endsWith('@g.us') ?? false;
}

function buildPayload(msg, receiverId) {
  const chatType = isGroupChat(msg) ? 'group' : 'private';
  const senderJid = chatType === 'group' ? msg.author : msg.from;
  return {
    wa_message_id: msg.id._serialized,
    receiver_id: receiverId,
    sender_phone: normalizeJid(senderJid),
    sender_name: msg._data?.notifyName ?? null,
    chat_type: chatType,
    group_name: chatType === 'group' ? normalizeJid(msg.from) : null,
    body: msg.body ?? null,
    wa_timestamp: new Date(msg.timestamp * 1000).toISOString(),
  };
}

async function buildAttachments(msg) {
  if (!msg.hasMedia) return [];

  const classified = classifyMedia(msg);
  if (classified.skip) return [];

  if (classified.kind === 'voice') {
    return [{ kind: 'voice', availability: 'not_stored' }];
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const media = await msg.downloadMedia();
      if (media?.data) {
        const bytes = base64Bytes(media.data);
        const availability = availabilityForSize(bytes);
        return [
          {
            kind: classified.kind,
            availability,
            original_name: media.filename ?? null,
            mime_type: media.mimetype ?? null,
            size_bytes: bytes,
            ...(availability === 'stored' ? { data_base64: media.data } : {}),
          },
        ];
      }
    } catch (err) {
      console.warn(`[wa-client] downloadMedia attempt ${attempt + 1}: ${err?.message ?? err}`);
    }
  }

  return [{ kind: classified.kind, availability: 'failed', original_name: null, mime_type: null }];
}

export function createWaClient({ queue, statusReporter }) {
  mkdirSync(config.sessionDir, { recursive: true });

  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: config.sessionDir }),
    puppeteer: { headless: true, args: ['--no-sandbox'] },
  });

  let firstAuthAt = loadFirstAuthAt(config.sessionDir);

  client.on('qr', async (qr) => {
    console.log('[wa-client] QR code received — scan with WhatsApp');
    try {
      const dataUrl = await qrcode.toDataURL(qr);
      statusReporter.setState('qr_required', dataUrl);
    } catch {
      statusReporter.setState('qr_required', null);
    }
  });

  client.on('authenticated', () => {
    console.log('[wa-client] authenticated');
    if (!firstAuthAt) {
      firstAuthAt = new Date().toISOString();
      saveFirstAuthAt(config.sessionDir, firstAuthAt);
    }
  });

  client.on('ready', () => {
    console.log('[wa-client] ready');
    statusReporter.setState('ready');
  });

  client.on('disconnected', (reason) => {
    console.warn(`[wa-client] disconnected: ${reason}`);
    statusReporter.setState('disconnected');
  });

  client.on('auth_failure', (msg) => {
    console.error(`[wa-client] auth_failure: ${msg}`);
    statusReporter.setState('disconnected');
  });

  client.on('message', async (msg) => {
    // Filter: skip outgoing, status broadcasts, and system messages.
    if (msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;
    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;

    // Respect the first-auth boundary: ignore messages older than our first connect.
    if (firstAuthAt) {
      const msgTime = new Date(msg.timestamp * 1000).toISOString();
      if (msgTime < firstAuthAt) return;
    }

    const payload = buildPayload(msg, config.receiverId);
    payload.attachments = await buildAttachments(msg);
    if (!payload.body && payload.attachments.length === 0) return;

    queue.enqueue(payload);
  });

  return {
    init: () => client.initialize(),
    destroy: () => client.destroy(),
  };
}
