# Code review: dev → main (WhatsApp-категоризация + групповой фильтр + очистка демо-данных)

Дата: 2026-07-09
Диапазон: `git diff main...HEAD` (5 коммитов: a4b6467, f4003e1, d1d5e7b, 1e07130, 6f14895)
Режим: read-only, изменения в код не вносились.

Проверено по цепочке route/guard → handler/service → API contract → persistence/внешние сервисы для всех затронутых файлов backend/connector/frontend. Ниже — только подтверждённые находки (2 независимых прохода: ручной + agent-верификация дали одинаковый результат).

---

## 1. [CRITICAL] Debug-логирование пишет тела всех входящих сообщений в бесконечно растущий незащищённый файл — и утраивает вызовы Puppeteer на каждое сообщение

**Файл:** `connector/src/wa-client.js:187-217`

**Доказательство:**
```js
client.on('message', async (msg) => {
  // [DEBUG TEMP] Лог любого входящего до фильтров в файл — для диагностики @ГЕМ.
  try {
    const isGroup = msg.from?.endsWith('@g.us') ?? false;
    const mentionsUs = await mentionsConfiguredNumber(msg);       // Puppeteer round-trip #1
    let resolvedMentions = null;
    try {
      resolvedMentions = (await msg.getMentions())?.map(...)     // Puppeteer round-trip #2
    } catch { /* ... */ }
    const line = JSON.stringify({ ..., body: msg.body ?? null, ... });
    writeFileSync(join(config.sessionDir, '..', 'wa-debug.log'), line + '\n', { flag: 'a' });
  } catch (e) {
    writeFileSync(join(config.sessionDir, '..', 'wa-debug.log'), `LOG_FAIL: ${e?.message}\n`, { flag: 'a' });
  }

  // Filter: skip outgoing, status broadcasts, and system messages.
  if (msg.fromMe) return;
  if (msg.from === 'status@broadcast') return;
  ...
  if (isGroupChat(msg) && !(await groupMessagePasses(msg))) return;   // Puppeteer round-trip #3 (для групп)
```
Блок помечен «`[DEBUG TEMP]`» — явный маркер, что это не предназначалось для мержа. Выполняется **до** всех фильтров (`fromMe`, `status@broadcast`, системные типы), т.е. на КАЖДОЕ событие `message`, включая собственные исходящие и статусы контактов.

**Риск:**
- **Приватность/утечка данных:** тела всех сообщений клиентов (включая номера, вложения-подписи) пишутся в открытый текстовый файл `connector/data/wa-debug.log` без ротации, без срока хранения, вне модели доступа БД — файл живёт вечно на диске сервера.
- **Отказ по диску:** `writeFileSync(..., { flag: 'a' })` без ротации/лимита — при постоянной работе коннектора файл растёт неограниченно → в проде рано или поздно диск закончится и упадёт весь хост (а не только коннектор).
- **Производительность/стабильность:** на каждое групповое сообщение `getMentions()` (реальный Puppeteer round-trip к странице WhatsApp Web) вызывается до **3 раз** вместо 1 (внутри `mentionsUs`, внутри `resolvedMentions`, и затем ещё раз в реальном фильтре `groupMessagePasses`). `getMentions()` — задокументированно нестабильный вызов (в `connector/test/filter.test.js` есть тест именно на его падение с `pupPage detached`), т.е. лишние вызовы — это лишний риск таймаутов/крашей и лишняя задержка на живом трафике.
- Синхронный `writeFileSync` в обработчике событий блокирует event loop на каждое сообщение.

**Минимальный fix:** удалить весь блок `[DEBUG TEMP]` целиком (строки 188-217). Если диагностика ещё нужна — вынести под `if (process.env.WA_DEBUG_LOG)`, не логировать `body`, использовать ротацию/лимит размера, и переиспользовать уже посчитанный результат `mentionsConfiguredNumber` вместо повторных вызовов.

**Какой тест должен был поймать:** нет и не может быть unit-теста, ловящего забытый debug-код — это ловится ревью/чек-листом перед мержем («грепнуть DEBUG/TEMP/TODO перед PR»). Технически можно добавить негативный тест: «`wa-client` не создаёт файлы вне `queueDir`/`sessionDir`», но это оверинжиниринг для этого случая — правильный фикс — просто убрать блок.

---

## 2. [HIGH] Групповые сообщения, прошедшие фильтр «тег ГЕМ», никогда не получают категорию `problem` — авто-категоризация не работает именно для того канала, ради которого её строили

**Файлы:**
- `connector/src/wa-client.js:53-56` (комментарий разработчиков, подтверждающий формат тела сообщения)
- `backend/src/services/wa-categories.js:221-238` (`categorizeText`)
- `backend/src/services/whatsapp.service.js:91` (`categorizeText(body)` на ingest)

**Доказательство:**
Комментарий в самом коде коннектора прямым текстом объясняет механику:
```js
// Сообщение тегает один из наших номеров (реальное WhatsApp-упоминание).
// В body такого тега лежит «@<id>», а не «@ГЕМ», поэтому ловим по упоминаниям.
async function mentionsConfiguredNumber(msg) { ... }
```
То есть при реальном WhatsApp-упоминании (`@`-тег контакта в группе) текст сообщения (`msg.body`), который дальше без изменений уходит в backend как `payload.body`, содержит `"@77057569731 ..."` (цифры JID), а НЕ `"@ГЕМ"`. Именно поэтому групповой фильтр коннектора (`mentionedIds` / `getMentions()`) вообще не смотрит на текст.

Но backend определяет категорию только по тексту:
```js
// wa-categories.js
const RAW_CATEGORIES = [
  { code: 'problem', label: 'ГЕМ', stems: ['@гем'] },
  ...
];
export function categorizeText(text) {
  ...
  if (words.some((word) => cat.stems.some((stem) => word.startsWith(stem)))) {
    return cat.code;
  }
  return DEFAULT_CATEGORY_CODE;
}
```
Слово `"@77057569731"` не начинается с `"@гем"` → категория всегда `other`.

**Failure scenario:** клиент в группе набирает `@` и выбирает из автодополнения WhatsApp контакт ГЕМ (номер из `GEM_MENTION_NUMBERS`), пишет «Коллеги @ГЕМ-Поддержка, база не открывается». Реальный протокольный текст — «Коллеги @77057569731 база не открывается». Коннектор корректно пропускает сообщение (это и есть цель фильтра, добавленного в этом диффе). Backend сохраняет `category='other'`, хотя это ровно тот тикет, который фича должна была пометить как «ГЕМ». Юнит-тесты (`backend/test/wa-categories.unit.test.js`, `backend/test/whatsapp.smoke.test.js`) это не ловят — они проверяют только буквальный текст `"@ГЕМ"` в теле (актуально для ЛС, где реальных упоминаний не бывает), но ни один тест не покрывает групповое сообщение с реальным тегом.

**Риск:** когда Фичи 4–6 (фильтр/бейдж «ГЕМ» в API и на фронте — см. `TASKS.md`, ещё не реализованы, чекбоксы пустые) будут сделаны, групповые заявки будут систематически не попадать под фильтр/бейдж «ГЕМ» — то есть фича категоризации сломана именно для группового канала, который и был основным поводом для доработки фильтра в этом же PR.

**Минимальный fix:** пробрасывать в payload от коннектора явный флаг, что сообщение прошло по реальному тегу (например `mentioned_gem: true`), и учитывать его в `categorizeText`/`ingestMessage` наравне с текстовым стемом — а не полагаться только на текст тела.

**Какой тест должен был поймать:** smoke-тест ingest с `chat_type: 'group'`, `body: 'Коллеги @77057569731 привет'` (реальный формат тега, а не буквальный «@ГЕМ»), ожидающий `category === 'problem'`. Такого теста сейчас нет — есть пробел в покрытии именно на стыке коннектор→backend.

---

## 3. [MEDIUM] `npm run seed:demo` больше не наполняет базу демо-данными — вопреки собственной документации проекта

**Файлы:**
- `backend/src/db/bootstrap.js` (полностью удалены `DEMO_DATA_SQL` и `shouldSeedDemoData`, `initializeDatabase` теперь выполняет только `SCHEMA_SQL` + `REFERENCE_DATA_SQL` + `recalculateAutoCategories`)
- `backend/scripts/reseed-demo.js` (не менялся, но его вывод теперь вводит в заблуждение)
- `CLAUDE.md` (не обновлён)

**Доказательство:**
```js
// bootstrap.js — было
if (shouldSeedDemoData(db)) {
  db.exec(DEMO_DATA_SQL);
}
// bootstrap.js — стало
recalculateAutoCategories(db);   // DEMO_DATA_SQL и shouldSeedDemoData удалены целиком
```
`reseed-demo.js` после этого коммита всё ещё печатает:
```js
console.log(`Demo database recreated: ${databasePath}`);
console.log(JSON.stringify(summary, null, 2));   // { clients: 0, employees: 0, contracts: 0, tickets: 0, workLogs: 0 }
```
А `CLAUDE.md` (сохранённый в этом же диффе, изменена только строчка про `GEM_MENTION_NUMBERS`) по-прежнему гласит:
> «Пересоздать базу с демо-данными: `npm run seed:demo`» / «удаляет helpdesk.sqlite и создаёт заново с демо-данными»

**Риск:** любой новый разработчик, следующий документированному «Быстрому старту» из CLAUDE.md, получает полностью пустое приложение (0 клиентов, 0 тикетов, 0 сообщений WhatsApp) — притом что консоль сообщает «Demo database recreated», что явно противоречит увиденному. Также `TASKS.md` (этот же дифф) содержит открытый (невыполненный) пункт «Этап 6. Демо-данные», который явно рассчитывает, что `npm run seed:demo` покажет категоризированные демо-сообщения — то есть удаление демо-сидинга конфликтует с собственным планом задачи из этого же PR.

**Минимальный fix:** либо вернуть демо-сидинг (например, только для `seed:demo`/дев-окружения, не трогая продовый бутстрап пустой БД), либо обновить `CLAUDE.md` и лог в `reseed-demo.js`, чтобы не обещать демо-данные, которых больше нет.

**Какой тест должен был поймать:** тест уровня «после `npm run seed:demo` таблица `clients` не пустая» (сейчас такого теста нет ни в backend, ни в CI) — либо это осознанное решение (судя по сообщению коммита `chore(db): не заполнять демо-данными при инициализации БД»), тогда нужен не тест, а синхронизация документации.

---

## Проверено и не является багом (для контекста)

- Пагинация `WaInboxPage.jsx` (лимит→offset/page) — backend (`whatsapp.service.js:listMessages`) уже поддерживал `offset`, контракт не нарушен.
- SQL-параметры в обновлённом `INSERT INTO wa_messages` (`whatsapp.service.js:93-111`) — количество `?` и переданных аргументов совпадает (10/10), `category_source` захардкожен как `'auto'` в самом запросе.
- `ON CONFLICT(wa_message_id) DO NOTHING` + ручная категория — повторный ingest корректно не перезаписывает `category_source='manual'` (подтверждено тестом `whatsapp.smoke.test.js`).
- `RECEIVER_PHONE` удалён из `config.js`/`CLAUDE.md` полностью и нигде в кодовой базе больше не упоминается — висячих ссылок нет.
- `COLUMN_MIGRATIONS` для новых колонок `category`/`category_source` — валидны для одновременной работы с `better-sqlite3` и `node:sqlite` (используется тот же `db.exec`/`db.prepare` API, что и для существующих миграций).
