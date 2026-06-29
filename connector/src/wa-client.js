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

// Приводим WhatsApp-идентификатор (строка «7705...@c.us» или объект с
// _serialized) к одним цифрам для сравнения с настроенными номерами.
function jidToDigits(id) {
  if (!id) return '';
  const s = typeof id === 'string' ? id : id._serialized || id.user || '';
  return String(s).replace(/\D/g, '');
}

// Все цифровые идентификаторы резолвнутого контакта-упоминания. При LID-адресации
// getMentions() возвращает контакт, у которого id уже заменён на реальный телефон
// (см. WWebJS.getContactModel), поэтому проверяем и id, и number.
function contactNumbers(contact) {
  return [jidToDigits(contact?.id), jidToDigits(contact?.number)].filter(Boolean);
}

// Сообщение тегает один из наших номеров (реальное WhatsApp-упоминание).
// В body такого тега лежит «@<id>», а не «@ГЕМ», поэтому ловим по упоминаниям.
// WhatsApp перешёл на LID: mentionedIds содержит скрытый «<id>@lid», а не телефон,
// поэтому при промахе по сырым id резолвим упоминания в контакты и сверяем номер.
async function mentionsConfiguredNumber(msg) {
  if (config.gemMentionNumbers.length === 0) return false;
  const rawDigits = (msg.mentionedIds ?? []).map(jidToDigits);
  if (config.gemMentionNumbers.some((num) => rawDigits.includes(num))) return true;
  if (typeof msg.getMentions !== 'function') return false;
  try {
    const contacts = (await msg.getMentions()) ?? [];
    const numbers = contacts.flatMap(contactNumbers);
    return config.gemMentionNumbers.some((num) => numbers.includes(num));
  } catch (err) {
    console.warn(`[wa-client] getMentions failed: ${err?.message ?? err}`);
    return false;
  }
}

// Итоговое правило для группового канала: только реальный тег контакта ГЕМ.
// Текстовое «@ГЕМ» намеренно не используется — в WhatsApp «@» всегда
// превращается в тег участника, поэтому набрать его обычным текстом нельзя.
async function groupMessagePasses(msg) {
  return mentionsConfiguredNumber(msg);
}

// Отображаемое имя (subject) группы. msg.from — это JID группы
// (<id>@g.us), а не её название, поэтому берём имя из чата.
// Откат на ID группы, если subject недоступен.
async function resolveGroupName(msg) {
  try {
    const chat = await msg.getChat();
    const name = chat?.name?.trim();
    if (name) return name;
  } catch (err) {
    console.warn(`[wa-client] getChat failed: ${err?.message ?? err}`);
  }
  return normalizeJid(msg.from);
}

async function buildPayload(msg, receiverId) {
  const chatType = isGroupChat(msg) ? 'group' : 'private';
  const senderJid = chatType === 'group' ? msg.author : msg.from;
  return {
    wa_message_id: msg.id._serialized,
    receiver_id: receiverId,
    sender_phone: normalizeJid(senderJid),
    sender_name: msg._data?.notifyName ?? null,
    chat_type: chatType,
    group_name: chatType === 'group' ? await resolveGroupName(msg) : null,
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
  let isRegenerating = false;

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
    // [DEBUG TEMP] Лог любого входящего до фильтров в файл — для диагностики @ГЕМ.
    try {
      const isGroup = msg.from?.endsWith('@g.us') ?? false;
      const mentionsUs = await mentionsConfiguredNumber(msg);
      let resolvedMentions = null;
      try {
        resolvedMentions = (await msg.getMentions())?.map((c) => ({
          id: c?.id?._serialized ?? null,
          number: c?.number ?? null,
        }));
      } catch {
        /* getMentions может упасть — для лога это не критично */
      }
      const line = JSON.stringify({
        at: new Date().toISOString(),
        from: msg.from,
        author: msg.author ?? null,
        type: msg.type,
        isGroup,
        body: msg.body ?? null,
        mentionedIds: msg.mentionedIds ?? null,
        resolvedMentions,
        gemNumbers: config.gemMentionNumbers,
        mentionsUs,
        groupPasses: isGroup ? mentionsUs : '(личный — всегда)',
      });
      writeFileSync(join(config.sessionDir, '..', 'wa-debug.log'), line + '\n', { flag: 'a' });
    } catch (e) {
      writeFileSync(join(config.sessionDir, '..', 'wa-debug.log'), `LOG_FAIL: ${e?.message}\n`, { flag: 'a' });
    }

    // Filter: skip outgoing, status broadcasts, and system messages.
    if (msg.fromMe) return;
    if (msg.from === 'status@broadcast') return;
    if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return;

    // Respect the first-auth boundary: ignore messages older than our first connect.
    if (firstAuthAt) {
      const msgTime = new Date(msg.timestamp * 1000).toISOString();
      if (msgTime < firstAuthAt) return;
    }

    // Группы: принимаем только при явном «@ГЕМ» (текст или тег нашего номера).
    // Личные чаты проходят всегда.
    if (isGroupChat(msg) && !(await groupMessagePasses(msg))) return;

    const payload = await buildPayload(msg, config.receiverId);
    payload.attachments = await buildAttachments(msg);
    if (!payload.body && payload.attachments.length === 0) return;

    queue.enqueue(payload);
  });

  async function regenerate() {
    if (isRegenerating) return;
    isRegenerating = true;
    console.log('[wa-client] regenerating QR — destroying and reinitializing');
    try {
      await client.destroy();
      await client.initialize();
    } catch (err) {
      console.error(`[wa-client] regenerate failed: ${err?.message ?? err}`);
    } finally {
      isRegenerating = false;
    }
  }

  return {
    init: () => client.initialize(),
    destroy: () => client.destroy(),
    regenerate,
  };
}
