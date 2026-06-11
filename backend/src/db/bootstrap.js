const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS statuses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL UNIQUE,
    sort_order INTEGER NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    tax_id TEXT,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    address TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL UNIQUE,
    position TEXT,
    phone TEXT,
    email TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    number TEXT NOT NULL UNIQUE,
    start_date TEXT,
    end_date TEXT,
    support_type TEXT,
    tariff TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    status_id INTEGER NOT NULL,
    responsible_employee_id INTEGER NOT NULL,
    subject TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    deadline TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (contract_id) REFERENCES contracts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (status_id) REFERENCES statuses(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (responsible_employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );

  CREATE TABLE IF NOT EXISTS work_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    employee_id INTEGER NOT NULL,
    work_date TEXT NOT NULL DEFAULT (date('now')),
    description TEXT NOT NULL,
    hours REAL NOT NULL CHECK (hours >= 0),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON UPDATE CASCADE ON DELETE RESTRICT
  );
`;

const REFERENCE_DATA_SQL = `
  INSERT OR IGNORE INTO statuses (id, code, name, sort_order) VALUES
    (1, 'new', 'Новая', 10),
    (2, 'in_progress', 'В работе', 20),
    (3, 'waiting_client', 'Ожидает клиента', 30),
    (4, 'done', 'Выполнена', 40),
    (5, 'closed', 'Закрыта', 50);

  INSERT OR IGNORE INTO categories (id, code, name, sort_order) VALUES
    (1, 'consultation', 'Консультация', 10),
    (2, 'customization', 'Доработка', 20),
    (3, 'bug', 'Ошибка', 30),
    (4, 'update', 'Обновление', 40),
    (5, 'integration', 'Интеграция', 50),
    (6, 'admin', 'Администрирование', 60);
`;

const DEMO_DATA_SQL = `
  INSERT INTO clients (id, name, tax_id, contact_person, phone, email, address) VALUES
    (1, 'ТОО Alpha Retail', '220140000001', 'Ирина Смирнова', '+7 701 100 10 10', 'office@alpharetail.kz', 'г. Алматы, пр. Абая, 15'),
    (2, 'ТОО Nomad Logistics', '210840000215', 'Данияр Сейтов', '+7 701 210 21 21', 'it@nomadlogistics.kz', 'г. Астана, ул. Сарайшык, 34'),
    (3, 'ИП Нурланов', '850501300123', 'Нурлан Нурланов', '+7 707 200 20 20', 'nurlan@example.kz', 'г. Шымкент, пр. Тауке хана, 91'),
    (4, 'ТОО Восток-Трейд', '191240000777', 'Марина Ким', '+7 777 300 30 30', 'support@vostok-trade.kz', 'г. Караганда, ул. Ермекова, 42'),
    (5, 'ТОО Medica Plus', '170540008812', 'Алия Турсунова', '+7 702 555 11 44', 'accounting@medicaplus.kz', 'г. Алматы, ул. Розыбакиева, 247'),
    (6, 'ТОО Qazaq Stroy Group', '160940012221', 'Руслан Муханов', '+7 775 610 77 88', 'erp@qstroy.kz', 'г. Астана, ул. Достык, 18'),
    (7, 'ТОО Sapa Market', '200740010900', 'Гульмира Жанабаева', '+7 708 420 55 66', 'ops@sapamarket.kz', 'г. Тараз, ул. Толе би, 53'),
    (8, 'ТОО AgroExport KZ', '180240004561', 'Ерлан Бекенов', '+7 701 333 22 11', 'fin@agroexport.kz', 'г. Костанай, ул. Аль-Фараби, 12');

  INSERT INTO employees (id, full_name, position, phone, email) VALUES
    (1, 'Алексей Петров', 'Консультант 1С', '+7 701 400 40 40', 'petrov@helpdesk.local'),
    (2, 'Дана Ахметова', 'Разработчик 1С', '+7 701 500 50 50', 'akhmetova@helpdesk.local'),
    (3, 'Сергей Волков', 'Специалист сопровождения', '+7 701 600 60 60', 'volkov@helpdesk.local'),
    (4, 'Екатерина Ли', 'Аналитик 1С', '+7 701 710 20 30', 'li@helpdesk.local'),
    (5, 'Марат Жумабеков', 'Инженер по интеграциям', '+7 701 811 22 33', 'zhumabekov@helpdesk.local'),
    (6, 'Ольга Соколова', 'Руководитель линии поддержки', '+7 701 922 44 55', 'sokolova@helpdesk.local');

  INSERT INTO contracts (id, client_id, number, start_date, end_date, support_type, tariff) VALUES
    (1, 1, 'AR-2026-001', date('now', '-8 months'), date('now', '+4 months'), 'ИТС и консультации', 'Стандарт'),
    (2, 2, 'NL-2026-004', date('now', '-10 months'), date('now', '+2 months'), 'Абонентское сопровождение', 'Расширенный'),
    (3, 3, 'IPN-2026-002', date('now', '-6 months'), date('now', '+6 months'), 'Точечные консультации', 'Базовый'),
    (4, 4, 'VT-2026-008', date('now', '-7 months'), date('now', '+5 months'), 'Доработки и обновления', 'Расширенный'),
    (5, 5, 'MP-2026-006', date('now', '-5 months'), date('now', '+7 months'), 'Комплексное сопровождение', 'Премиум'),
    (6, 6, 'QSG-2026-003', date('now', '-9 months'), date('now', '+3 months'), 'Поддержка ERP', 'Премиум'),
    (7, 7, 'SM-2026-005', date('now', '-4 months'), date('now', '+8 months'), 'Сопровождение розницы', 'Стандарт'),
    (8, 8, 'AE-2026-007', date('now', '-3 months'), date('now', '+9 months'), 'Интеграции и обмены', 'Расширенный');

  INSERT INTO tickets (
    id,
    contract_id,
    category_id,
    status_id,
    responsible_employee_id,
    subject,
    description,
    priority,
    created_at,
    deadline,
    updated_at
  ) VALUES
    (1, 1, 3, 2, 2, 'После обновления не запускается база 1С', 'После перехода на новый релиз бухгалтерии пользователи получают ошибку при входе в информационную базу.', 'urgent', datetime('now', '-12 days'), datetime('now', '-2 days'), datetime('now', '-1 days')),
    (2, 4, 2, 3, 4, 'Доработать печатную форму счета на оплату', 'Нужно добавить логотип, банковские реквизиты филиала и подпись ответственного менеджера.', 'high', datetime('now', '-10 days'), datetime('now', '+2 days'), datetime('now', '-1 days')),
    (3, 3, 4, 5, 3, 'Обновить релиз 1С:Бухгалтерии до актуального', 'Обновление выполнено, требуется только хранение истории и закрытие обращения.', 'normal', datetime('now', '-18 days'), datetime('now', '-11 days'), datetime('now', '-9 days')),
    (4, 1, 1, 5, 1, 'Консультация по закрытию месяца', 'Клиенту требовалось объяснить порядок перепроведения документов и сверки взаиморасчетов.', 'low', datetime('now', '-25 days'), datetime('now', '-23 days'), datetime('now', '-22 days')),
    (5, 5, 5, 2, 5, 'Настроить обмен с сайтом на Bitrix', 'Необходимо передавать заказы и остатки между 1С:УТ и интернет-магазином каждые 15 минут.', 'high', datetime('now', '-8 days'), datetime('now', '+5 days'), datetime('now', '-1 days')),
    (6, 6, 6, 2, 6, 'Права пользователей в 1С:ERP настроены некорректно', 'У кладовщиков пропал доступ к ордерам на перемещение после изменения ролей.', 'high', datetime('now', '-6 days'), datetime('now', '+1 days'), datetime('now', '-1 days')),
    (7, 2, 3, 1, 2, 'Ошибка при расчете зарплаты за май', 'При заполнении начислений появляется сообщение об отсутствии данных по графику сотрудника.', 'urgent', datetime('now', '-3 days'), datetime('now', '+1 days'), datetime('now', '-3 days')),
    (8, 7, 1, 4, 1, 'Показать, как оформить возврат от покупателя', 'Клиенту нужна инструкция по корректному оформлению возврата и печати чека ККМ.', 'normal', datetime('now', '-7 days'), datetime('now', '-1 days'), datetime('now', '-1 days')),
    (9, 8, 5, 2, 5, 'Интеграция с Kaspi API: не загружаются статусы заказов', 'После смены токена обмен перестал обновлять статусы и трекинг по доставке.', 'urgent', datetime('now', '-9 days'), datetime('now', '-1 days'), datetime('now', '-1 days')),
    (10, 2, 4, 4, 3, 'Обновить платформу 1С до 8.3.25', 'Платформа обновлена на тестовом и рабочем контуре, выполнена проверка основных сценариев.', 'normal', datetime('now', '-14 days'), datetime('now', '-7 days'), datetime('now', '-6 days')),
    (11, 5, 2, 2, 2, 'Добавить реквизит серии в печатную форму УПД', 'Для медицинских товаров нужно вывести серию партии и срок годности в печатную форму.', 'high', datetime('now', '-4 days'), datetime('now', '+4 days'), datetime('now', '-1 days')),
    (12, 6, 6, 3, 6, 'Согласовать регламент резервного копирования', 'Подготовлен проект расписания бэкапов и политики хранения, ожидается подтверждение ИТ-руководителя клиента.', 'normal', datetime('now', '-11 days'), datetime('now', '+6 days'), datetime('now', '-2 days')),
    (13, 7, 3, 5, 3, 'Исправить задвоение чеков после обмена с кассой', 'Проблема локализована в обработке повторной выгрузки, патч установлен и подтвержден клиентом.', 'high', datetime('now', '-16 days'), datetime('now', '-10 days'), datetime('now', '-8 days')),
    (14, 8, 1, 2, 4, 'Проконсультировать по учету экспортных операций', 'Нужны рекомендации по отражению валютной выручки, НДС и курсовых разниц в 1С.', 'normal', datetime('now', '-2 days'), datetime('now', '+3 days'), datetime('now', '-1 days'));

  INSERT INTO work_logs (id, ticket_id, employee_id, work_date, description, hours) VALUES
    (1, 1, 1, date('now', '-11 days'), 'Проверили доступность сервера 1С и журнал регистрации, воспроизвели ошибку входа.', 1.5),
    (2, 1, 2, date('now', '-10 days'), 'Выявили проблему с несовместимой внешней компонентой после обновления релиза.', 2),
    (3, 1, 2, date('now', '-9 days'), 'Подготовили исправление и протестировали запуск базы на копии.', 2.5),
    (4, 2, 4, date('now', '-9 days'), 'Собрали требования по новой печатной форме и согласовали образец макета.', 1.5),
    (5, 2, 2, date('now', '-8 days'), 'Внесли изменения в макет счета, добавили реквизиты и место для подписи.', 3),
    (6, 3, 3, date('now', '-17 days'), 'Сделали резервную копию, обновили конфигурацию и проверили регламентированные отчеты.', 3.5),
    (7, 4, 1, date('now', '-24 days'), 'Провели консультацию по закрытию месяца и отправили памятку бухгалтеру.', 1),
    (8, 5, 5, date('now', '-7 days'), 'Настроили тестовый обмен с сайтом, проверили структуру JSON по заказам.', 2.5),
    (9, 5, 5, date('now', '-6 days'), 'Исправили сопоставление складов и единиц измерения для выгрузки остатков.', 2),
    (10, 6, 6, date('now', '-5 days'), 'Проверили матрицу ролей, выявили конфликт после изменения профилей доступа.', 1.5),
    (11, 6, 6, date('now', '-4 days'), 'Подготовили новую роль для кладовщиков и согласовали список доступных операций.', 2),
    (12, 7, 2, date('now', '-2 days'), 'Запросили базу-копию и журнал расчета, начали анализ причин ошибки.', 1),
    (13, 8, 1, date('now', '-6 days'), 'Показали пошаговый сценарий оформления возврата и проверили печать чека.', 1.5),
    (14, 9, 5, date('now', '-8 days'), 'Проверили авторизацию в API Kaspi и журнал ошибок обмена.', 2),
    (15, 9, 5, date('now', '-7 days'), 'Обновили токен, исправили обработку ответа сервиса и запустили повторную синхронизацию.', 2.5),
    (16, 10, 3, date('now', '-13 days'), 'Обновили платформу на тестовом контуре и проверили запуск ключевых обработок.', 2),
    (17, 10, 3, date('now', '-12 days'), 'Перенесли обновление на рабочий контур и сверили производительность.', 2),
    (18, 11, 4, date('now', '-3 days'), 'Уточнили требования по УПД и пример печатной формы от клиента.', 1),
    (19, 11, 2, date('now', '-2 days'), 'Добавили вывод серии и срока годности в табличную часть печати.', 2.5),
    (20, 12, 6, date('now', '-10 days'), 'Подготовили регламент резервного копирования и расписание контроля.', 1.5),
    (21, 13, 3, date('now', '-15 days'), 'Локализовали источник задвоения чеков в механизме повторной отправки.', 2),
    (22, 13, 2, date('now', '-14 days'), 'Внесли патч в обработку обмена и провели тестовый цикл с кассой.', 2.5),
    (23, 14, 4, date('now', '-1 days'), 'Собрали вопросы клиента по экспортным операциям и подготовили список сценариев.', 1),
    (24, 14, 1, date('now', '-1 days'), 'Провели консультацию по валютному учету и курсовым разницам.', 1.5),
    (25, 5, 2, date('now', '-5 days'), 'Согласовали правила сопоставления номенклатуры для обмена с сайтом.', 1.5);
`;

function getCount(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get()?.count ?? 0;
}

function shouldSeedDemoData(db) {
  const businessTables = ['clients', 'contracts', 'employees', 'tickets', 'work_logs'];
  return businessTables.every((tableName) => getCount(db, tableName) === 0);
}

export function initializeDatabase(db) {
  db.exec(SCHEMA_SQL);
  db.exec(REFERENCE_DATA_SQL);

  if (shouldSeedDemoData(db)) {
    db.exec(DEMO_DATA_SQL);
  }
}
