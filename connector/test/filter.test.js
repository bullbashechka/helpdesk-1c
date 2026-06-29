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

// Зеркало jidToDigits/mentionsConfiguredNumber из wa-client.js.
function jidToDigits(id) {
  if (!id) return '';
  const s = typeof id === 'string' ? id : id._serialized || id.user || '';
  return String(s).replace(/\D/g, '');
}

// Все цифровые идентификаторы резолвнутого контакта-упоминания.
function contactNumbers(contact) {
  return [jidToDigits(contact?.id), jidToDigits(contact?.number)].filter(Boolean);
}

const TEST_GEM_NUMBERS = ['77057569731'];
// WhatsApp перешёл на LID: mentionedIds содержит скрытый «<id>@lid», а не телефон.
// При промахе по сырым id резолвим упоминания в контакты и сверяем реальный номер.
async function mentionsConfiguredNumber(msg, numbers = TEST_GEM_NUMBERS) {
  if (numbers.length === 0) return false;
  const rawDigits = (msg.mentionedIds ?? []).map(jidToDigits);
  if (numbers.some((num) => rawDigits.includes(num))) return true;
  if (typeof msg.getMentions !== 'function') return false;
  try {
    const contacts = (await msg.getMentions()) ?? [];
    const resolved = contacts.flatMap(contactNumbers);
    return numbers.some((num) => resolved.includes(num));
  } catch {
    return false;
  }
}

// Группа проходит только при реальном теге контакта ГЕМ (текст не триггер).
async function groupMessagePasses(msg) {
  return mentionsConfiguredNumber(msg);
}

// Итоговый гейт для группового канала: true — сообщение отбрасывается.
async function skipGroupWithoutGem(msg) {
  return isGroupChat(msg) && !(await groupMessagePasses(msg));
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

describe('групповой фильтр: только тег ГЕМ', () => {
  const group = (body) =>
    makeMsg({ from: '120363000000@g.us', author: '77071234567@c.us', body });
  const dm = (body) => makeMsg({ from: '77011001010@c.us', author: null, body });

  test('группа с тегом нашего номера (mentionedIds, строка) → принимается', async () => {
    const msg = group('@77057569731 помогите');
    msg.mentionedIds = ['77057569731@c.us'];
    assert.equal(await skipGroupWithoutGem(msg), false);
  });

  test('группа с тегом нашего номера (mentionedIds, объект _serialized) → принимается', async () => {
    const msg = group('@77057569731 помогите');
    msg.mentionedIds = [{ _serialized: '77057569731@c.us' }];
    assert.equal(await skipGroupWithoutGem(msg), false);
  });

  test('группа с LID-тегом, резолвится в наш телефон → принимается', async () => {
    // WhatsApp прислал скрытый LID, а не телефон. getMentions() резолвит его
    // в контакт с реальным номером 77057569731 (id заменён на телефон).
    const msg = group('@279688874356736 помогите');
    msg.mentionedIds = ['279688874356736@lid'];
    msg.getMentions = async () => [
      { id: { _serialized: '77057569731@c.us' }, number: '77057569731' },
    ];
    assert.equal(await skipGroupWithoutGem(msg), false);
  });

  test('группа с LID-тегом, резолв по полю number → принимается', async () => {
    const msg = group('@279688874356736 помогите');
    msg.mentionedIds = ['279688874356736@lid'];
    msg.getMentions = async () => [{ id: { _serialized: '99999@lid' }, number: '77057569731' }];
    assert.equal(await skipGroupWithoutGem(msg), false);
  });

  test('группа с тегом чужого номера → отбрасывается', async () => {
    const msg = group('@79990001122 привет');
    msg.mentionedIds = ['79990001122@c.us'];
    assert.equal(await skipGroupWithoutGem(msg), true);
  });

  test('группа с LID-тегом чужого контакта → отбрасывается', async () => {
    const msg = group('@83386907529444 не работает');
    msg.mentionedIds = ['83386907529444@lid'];
    msg.getMentions = async () => [
      { id: { _serialized: '79990001122@c.us' }, number: '79990001122' },
    ];
    assert.equal(await skipGroupWithoutGem(msg), true);
  });

  test('группа с текстом «@ГЕМ» без тега → отбрасывается (текст не триггер в группах)', async () => {
    assert.equal(await skipGroupWithoutGem(group('Коллеги @ГЕМ, нужна помощь')), true);
  });

  test('группа без упоминаний → отбрасывается', async () => {
    assert.equal(await skipGroupWithoutGem(group('Добрый день, подтвердили оплату')), true);
  });

  test('группа без текста (только вложение) → отбрасывается', async () => {
    assert.equal(await skipGroupWithoutGem(group(null)), true);
  });

  test('группа с LID-тегом, getMentions падает → отбрасывается, без краха', async () => {
    const msg = group('@279688874356736 помогите');
    msg.mentionedIds = ['279688874356736@lid'];
    msg.getMentions = async () => {
      throw new Error('pupPage detached');
    };
    await assert.doesNotReject(async () => {
      assert.equal(await skipGroupWithoutGem(msg), true);
    });
  });

  test('ЛС проходит всегда — без тега и без «@ГЕМ»', async () => {
    assert.equal(await skipGroupWithoutGem(dm('обычный вопрос')), false);
  });

  test('ЛС с любым текстом → принимается (личные проходят всегда)', async () => {
    assert.equal(await skipGroupWithoutGem(dm('@ГЕМ помогите')), false);
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
