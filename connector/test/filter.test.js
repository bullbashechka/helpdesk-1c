import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

// Inline the filter logic to test it without importing wa-client (which pulls whatsapp-web.js + Puppeteer).
function shouldSkip(msg) {
  if (msg.fromMe) return true;
  if (msg.from === 'status@broadcast') return true;
  if (msg.type === 'e2e_notification' || msg.type === 'notification_template') return true;
  return false;
}

function isGroupChat(msg) {
  return msg.from?.endsWith('@g.us') ?? false;
}

// Зеркало логики из wa-client.js: групповое сообщение принимается только при
// явном «@ГЕМ» (правило совпадает с категоризацией на backend).
function hasGemMention(text) {
  if (!text) return false;
  return String(text)
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.replace(/^#+/, ''))
    .some((word) => word.startsWith('@гем'));
}

// Итоговый гейт для группового канала: true — сообщение отбрасывается.
function skipGroupWithoutGem(msg) {
  return isGroupChat(msg) && !hasGemMention(msg.body);
}

function normalizeJid(jid) {
  if (!jid) return '';
  return jid.includes('@') ? jid.split('@')[0] : jid;
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

const makeMsg = (overrides) => ({
  id: { _serialized: 'test_msg_1' },
  from: '77011234567@c.us',
  fromMe: false,
  author: null,
  type: 'chat',
  body: 'тест',
  timestamp: Math.floor(Date.now() / 1000),
  _data: { notifyName: 'Иван' },
  ...overrides,
});

describe('message filter', () => {
  test('принимает обычное входящее', () => {
    assert.equal(shouldSkip(makeMsg()), false);
  });

  test('отбрасывает исходящее (fromMe)', () => {
    assert.equal(shouldSkip(makeMsg({ fromMe: true })), true);
  });

  test('отбрасывает status@broadcast', () => {
    assert.equal(shouldSkip(makeMsg({ from: 'status@broadcast' })), true);
  });

  test('отбрасывает системные e2e_notification', () => {
    assert.equal(shouldSkip(makeMsg({ type: 'e2e_notification' })), true);
  });

  test('отбрасывает notification_template', () => {
    assert.equal(shouldSkip(makeMsg({ type: 'notification_template' })), true);
  });

  test('принимает групповое сообщение', () => {
    const msg = makeMsg({ from: '120363000000@g.us', author: '77071234567@c.us', fromMe: false });
    assert.equal(shouldSkip(msg), false);
    const payload = buildPayload(msg, 1);
    assert.equal(payload.chat_type, 'group');
    assert.equal(payload.sender_phone, '77071234567'); // author, not group JID
    assert.equal(payload.group_name, '120363000000');
  });
});

describe('групповой фильтр @ГЕМ', () => {
  const group = (body) =>
    makeMsg({ from: '120363000000@g.us', author: '77071234567@c.us', body });
  const dm = (body) => makeMsg({ from: '77011001010@c.us', author: null, body });

  test('группа с @ГЕМ → принимается', () => {
    assert.equal(skipGroupWithoutGem(group('Коллеги @ГЕМ, нужна помощь')), false);
  });

  test('группа с @ГЕМ в любом регистре → принимается', () => {
    assert.equal(skipGroupWithoutGem(group('@гем срочно')), false);
  });

  test('группа с @ГЕМ-СК (хвост) → принимается', () => {
    assert.equal(skipGroupWithoutGem(group('@ГЕМ-СК вопрос')), false);
  });

  test('группа без @ГЕМ → отбрасывается', () => {
    assert.equal(skipGroupWithoutGem(group('Добрый день, подтвердили оплату')), true);
  });

  test('группа без текста (только вложение) → отбрасывается', () => {
    assert.equal(skipGroupWithoutGem(group(null)), true);
  });

  test('группа с user@гем (внутри слова) → отбрасывается, нет ложного срабатывания', () => {
    assert.equal(skipGroupWithoutGem(group('пишите на user@гем.kz')), true);
  });

  test('ЛС без @ГЕМ → принимается (личные проходят всегда)', () => {
    assert.equal(skipGroupWithoutGem(dm('обычный вопрос')), false);
  });

  test('ЛС с @ГЕМ → принимается', () => {
    assert.equal(skipGroupWithoutGem(dm('@ГЕМ помогите')), false);
  });
});

describe('firstAuthAt boundary', () => {
  test('отбрасывает сообщения старше firstAuthAt', () => {
    const firstAuthAt = new Date('2026-01-10T10:00:00.000Z').toISOString();
    const oldTs = Math.floor(new Date('2026-01-09T09:00:00.000Z').getTime() / 1000);
    const msgTime = new Date(oldTs * 1000).toISOString();
    assert.equal(msgTime < firstAuthAt, true);
  });

  test('принимает сообщения позже firstAuthAt', () => {
    const firstAuthAt = new Date('2026-01-10T10:00:00.000Z').toISOString();
    const newTs = Math.floor(new Date('2026-01-10T11:00:00.000Z').getTime() / 1000);
    const msgTime = new Date(newTs * 1000).toISOString();
    assert.equal(msgTime < firstAuthAt, false);
  });
});

describe('buildPayload', () => {
  test('личный чат — sender_phone из msg.from', () => {
    const msg = makeMsg({ from: '77011001010@c.us', author: null });
    const p = buildPayload(msg, 1);
    assert.equal(p.sender_phone, '77011001010');
    assert.equal(p.chat_type, 'private');
    assert.equal(p.group_name, null);
  });

  test('нормализация JID без домена остаётся как есть', () => {
    const msg = makeMsg({ from: '77011001010', author: null });
    const p = buildPayload(msg, 1);
    assert.equal(p.sender_phone, '77011001010');
  });
});
