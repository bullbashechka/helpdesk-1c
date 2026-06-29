const RAW_CATEGORIES = [
  { code: 'problem', label: 'ГЕМ', stems: ['@гем'] },
  { code: 'other', label: 'Прочее', stems: [] },
];

const DEFAULT_CATEGORY_CODE = 'other';

// Нормализуем стемы при загрузке: нижний регистр, trim, пустые отбрасываются.
// Защита от случайного пустого стема в конфиге (пустой стем совпал бы с любым словом).
const CATEGORIES = RAW_CATEGORIES.map((cat) => ({
  ...cat,
  stems: cat.stems.map((s) => String(s).toLowerCase().trim()).filter(Boolean),
}));

export { CATEGORIES, DEFAULT_CATEGORY_CODE };

export const CATEGORY_CODES = CATEGORIES.map((c) => c.code);

export function isValidCategoryCode(code) {
  return CATEGORY_CODES.includes(code);
}

export function categorizeText(text) {
  if (text == null || String(text).trim() === '') return DEFAULT_CATEGORY_CODE;

  const words = text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.replace(/^#+/, ''));

  for (const cat of CATEGORIES) {
    if (cat.stems.length === 0) continue;
    if (words.some((word) => cat.stems.some((stem) => word.startsWith(stem)))) {
      return cat.code;
    }
  }

  return DEFAULT_CATEGORY_CODE;
}

export function recalculateAutoCategories(db, categorize = categorizeText) {
  const rows = db
    .prepare("SELECT id, body, category FROM wa_messages WHERE category_source = 'auto'")
    .all();

  const toUpdate = rows.filter((r) => categorize(r.body) !== r.category);
  if (toUpdate.length === 0) return 0;

  const update = db.prepare('UPDATE wa_messages SET category = ? WHERE id = ?');
  db.exec('BEGIN');
  try {
    for (const r of toUpdate) {
      update.run(categorize(r.body), r.id);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return toUpdate.length;
}
