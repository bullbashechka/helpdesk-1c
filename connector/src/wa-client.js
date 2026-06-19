import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import qrcode from 'qrcode';
import pkg from 'whatsapp-web.js';
const { Client, LocalAuth } = pkg;

import { config } from './config.js';

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

  client.on('message', (msg) => {
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
    queue.enqueue(payload);
  });

  return {
    init: () => client.initialize(),
    destroy: () => client.destroy(),
  };
}
