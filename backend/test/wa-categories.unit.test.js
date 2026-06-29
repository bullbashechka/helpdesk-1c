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

describe('categorizeText — упоминание «@ГЕМ»', () => {
  test('@ГЕМ', () => assert.equal(categorizeText('@ГЕМ'), 'problem'));
  test('@гем', () => assert.equal(categorizeText('@гем'), 'problem'));
  test('@Гем', () => assert.equal(categorizeText('@Гем'), 'problem'));
  test('@ГЕМ в составе фразы', () => assert.equal(categorizeText('срочно для @ГЕМ помогите'), 'problem'));
});

describe('categorizeText — регистр', () => {
  test('@ГЕМ', () => assert.equal(categorizeText('@ГЕМ'), 'problem'));
  test('@гЕм', () => assert.equal(categorizeText('@гЕм'), 'problem'));
});

describe('categorizeText — хвост знаков препинания', () => {
  test('@ГЕМ!!!', () => assert.equal(categorizeText('@ГЕМ!!!'), 'problem'));
  test('@ГЕМ,', () => assert.equal(categorizeText('@ГЕМ,'), 'problem'));
});

describe('categorizeText — многострочность', () => {
  test('упоминание на второй строке', () => assert.equal(categorizeText('строка один\n@ГЕМ'), 'problem'));
  test('таб как разделитель', () => assert.equal(categorizeText('коллеги\t@ГЕМ'), 'problem'));
});

describe('categorizeText — пограничные совпадения', () => {
  test('@ГЕМ-СК → problem (совпадение по началу слова)', () => assert.equal(categorizeText('@ГЕМ-СК'), 'problem'));
});

describe('categorizeText — негативные случаи', () => {
  test('обычное сообщение → other', () => assert.equal(categorizeText('добрый день, когда отчёт'), 'other'));
  test('почта user@гем.kz → other (не начинается с @гем)', () => assert.equal(categorizeText('пишите на user@гем.kz'), 'other'));
  test('слово «гем» без @ → other', () => assert.equal(categorizeText('гематоген закончился'), 'other'));
  test('слово «проблема» больше не триггер → other', () => assert.equal(categorizeText('у нас проблема'), 'other'));
});

describe('categorizeText — обрамление спереди (осознанный компромисс)', () => {
  test('(@ГЕМ) → other', () => assert.equal(categorizeText('(@ГЕМ)'), 'other'));
  test('"@ГЕМ" → other', () => assert.equal(categorizeText('"@ГЕМ"'), 'other'));
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
