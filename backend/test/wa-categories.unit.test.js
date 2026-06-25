import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import {
  CATEGORIES,
  CATEGORY_CODES,
  categorizeText,
  isValidCategoryCode,
  recalculateAutoCategories,
} from '../src/services/wa-categories.js';

// DB-контекст для тестов recalculateAutoCategories
const testDataDir = mkdtempSync(join(tmpdir(), 'helpdesk-wac-'));
process.env.SQLITE_DB_PATH = join(testDataDir, 'helpdesk.sqlite');
process.env.FRONTEND_ORIGIN = 'http://localhost:5173';
process.env.WHATSAPP_CONNECTOR_TOKEN = 'test-token';
process.env.WA_ATTACHMENTS_DIR = join(testDataDir, 'wa-attachments');

const { getDatabase, closeDatabase } = await import('../src/db/database.js');

after(() => {
  closeDatabase();
  rmSync(testDataDir, { force: true, recursive: true });
});

// ── Чистые функции ────────────────────────────────────────────────────────────

describe('categorizeText — падежи «проблем*»', () => {
  for (const word of ['проблема', 'проблемы', 'проблему', 'проблемой', 'проблеме', 'проблем']) {
    test(word, () => assert.equal(categorizeText(word), 'problem'));
  }
});

describe('categorizeText — хэштег', () => {
  test('#проблема', () => assert.equal(categorizeText('#проблема'), 'problem'));
  test('##проблема', () => assert.equal(categorizeText('##проблема'), 'problem'));
});

describe('categorizeText — регистр', () => {
  test('ПРОБЛЕМА', () => assert.equal(categorizeText('ПРОБЛЕМА'), 'problem'));
  test('Проблема', () => assert.equal(categorizeText('Проблема'), 'problem'));
});

describe('categorizeText — хвост знаков препинания', () => {
  test('проблема!!!', () => assert.equal(categorizeText('проблема!!!'), 'problem'));
  test('проблема,', () => assert.equal(categorizeText('проблема,'), 'problem'));
});

describe('categorizeText — многострочность', () => {
  test('слово на второй строке', () => assert.equal(categorizeText('строка один\nпроблема'), 'problem'));
  test('таб как разделитель', () => assert.equal(categorizeText('есть\tпроблема'), 'problem'));
});

describe('categorizeText — пограничные совпадения', () => {
  test('проблематично → problem', () => assert.equal(categorizeText('проблематично'), 'problem'));
  test('беспроблемный → other (нет ложного срабатывания)', () => assert.equal(categorizeText('беспроблемный'), 'other'));
});

describe('categorizeText — негативные случаи', () => {
  test('обычное сообщение → other', () => assert.equal(categorizeText('добрый день, когда отчёт'), 'other'));
  test('беспроблемный → other', () => assert.equal(categorizeText('беспроблемный'), 'other'));
});

describe('categorizeText — обрамление спереди (осознанный компромисс)', () => {
  test('(проблема) → other', () => assert.equal(categorizeText('(проблема)'), 'other'));
  test('"проблема" → other', () => assert.equal(categorizeText('"проблема"'), 'other'));
  test('...проблема → other', () => assert.equal(categorizeText('...проблема'), 'other'));
});

describe('categorizeText — нет текста', () => {
  test("'' → other", () => assert.equal(categorizeText(''), 'other'));
  test("'   ' → other", () => assert.equal(categorizeText('   '), 'other'));
  test('null → other', () => assert.equal(categorizeText(null), 'other'));
  test('undefined → other', () => assert.equal(categorizeText(undefined), 'other'));
});

describe('хелперы конфигурации', () => {
  test('isValidCategoryCode — problem', () => assert.ok(isValidCategoryCode('problem')));
  test('isValidCategoryCode — other', () => assert.ok(isValidCategoryCode('other')));
  test('isValidCategoryCode — неизвестный код', () => assert.ok(!isValidCategoryCode('foo')));
  test('isValidCategoryCode — пустая строка', () => assert.ok(!isValidCategoryCode('')));
  test('CATEGORY_CODES содержит problem', () => assert.ok(CATEGORY_CODES.includes('problem')));
  test('CATEGORY_CODES содержит other', () => assert.ok(CATEGORY_CODES.includes('other')));
  test('CATEGORIES — массив с label', () => {
    assert.ok(Array.isArray(CATEGORIES));
    assert.ok(CATEGORIES.every((c) => c.code && c.label));
  });
});

// ── recalculateAutoCategories ─────────────────────────────────────────────────

describe('recalculateAutoCategories — пересчёт категорий', () => {
  test('auto-сообщение получает обновлённую категорию при смене конфига', () => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO wa_messages
         (wa_message_id, receiver_id, sender_phone, chat_type, body, wa_timestamp, category, category_source)
       VALUES (?, 1, '79990000011', 'private', ?, datetime('now'), 'other', 'auto')`,
    ).run('unit_RECALC_AUTO_1', 'сбой платёжной системы');

    // Конфиг «сменился»: теперь «сбой» → problem
    recalculateAutoCategories(db, (text) =>
      text && text.toLowerCase().includes('сбой') ? 'problem' : 'other',
    );

    const row = db.prepare('SELECT category FROM wa_messages WHERE wa_message_id = ?').get('unit_RECALC_AUTO_1');
    assert.equal(row.category, 'problem');
  });

  test('manual-сообщение не трогается при пересчёте', () => {
    const db = getDatabase();
    db.prepare(
      `INSERT INTO wa_messages
         (wa_message_id, receiver_id, sender_phone, chat_type, body, wa_timestamp, category, category_source)
       VALUES (?, 1, '79990000012', 'private', ?, datetime('now'), 'problem', 'manual')`,
    ).run('unit_RECALC_MANUAL_1', 'обычный привет без пометки');

    // Если бы это было auto — стало бы 'other'; но manual неприкосновенно
    recalculateAutoCategories(db, () => 'other');

    const row = db
      .prepare('SELECT category, category_source FROM wa_messages WHERE wa_message_id = ?')
      .get('unit_RECALC_MANUAL_1');
    assert.equal(row.category, 'problem');
    assert.equal(row.category_source, 'manual');
  });

  test('возвращает неотрицательное целое число — количество обновлённых строк', () => {
    const db = getDatabase();
    const result = recalculateAutoCategories(db, categorizeText);
    assert.equal(typeof result, 'number');
    assert.ok(Number.isInteger(result));
    assert.ok(result >= 0);
  });
});
