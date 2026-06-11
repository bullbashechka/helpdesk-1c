const statuses = [
  ['new', 'новая', 10],
  ['in_progress', 'в работе', 20],
  ['waiting_client', 'ожидает клиента', 30],
  ['done', 'выполнена', 40],
  ['closed', 'закрыта', 50],
];

const categories = [
  ['consultation', 'консультация', 10],
  ['customization', 'доработка', 20],
  ['bug', 'ошибка', 30],
  ['update', 'обновление', 40],
];

export function seedDatabase(db) {
  seedDictionaries(db);
  seedDemoData(db);
}

function seedDictionaries(db) {
  const insertStatus = db.prepare(`
    INSERT INTO statuses (code, name, sort_order)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      sort_order = excluded.sort_order
  `);

  const insertCategory = db.prepare(`
    INSERT INTO categories (code, name, sort_order)
    VALUES (?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      name = excluded.name,
      sort_order = excluded.sort_order
  `);

  statuses.forEach((status) => insertStatus.run(status));
  categories.forEach((category) => insertCategory.run(category));
}

function seedDemoData(db) {
  const demoTicketCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM tickets
    WHERE subject IN (
      'Не открывается база 1С',
      'Настроить печатную форму счета',
      'Обновить релиз бухгалтерии',
      'Консультация по закрытию месяца'
    )
  `).get().count;

  if (demoTicketCount > 0) {
    return;
  }

  const insertClient = db.prepare(`
    INSERT OR IGNORE INTO clients (name, tax_id, contact_person, phone, email, address)
    VALUES (@name, @taxId, @contactPerson, @phone, @email, @address)
  `);

  const insertContract = db.prepare(`
    INSERT OR IGNORE INTO contracts (client_id, number, start_date, end_date, support_type, tariff)
    VALUES (@clientId, @number, @startDate, @endDate, @supportType, @tariff)
  `);

  const insertEmployee = db.prepare(`
    INSERT OR IGNORE INTO employees (full_name, position, phone, email)
    VALUES (@fullName, @position, @phone, @email)
  `);

  [
    {
      name: 'ТОО Альфа-Сервис',
      taxId: '220140000001',
      contactPerson: 'Ирина Смирнова',
      phone: '+7 701 100 10 10',
      email: 'office@alpha-service.kz',
      address: 'г. Алматы, ул. Абая, 15',
    },
    {
      name: 'ИП Нурланов',
      taxId: '850501300123',
      contactPerson: 'Нурлан Нурланов',
      phone: '+7 707 200 20 20',
      email: 'nurlan@example.kz',
      address: 'г. Астана, пр. Кабанбай батыра, 8',
    },
    {
      name: 'ТОО Восток-Трейд',
      taxId: '191240000777',
      contactPerson: 'Марина Ким',
      phone: '+7 777 300 30 30',
      email: 'support@vostok-trade.kz',
      address: 'г. Караганда, ул. Ермекова, 42',
    },
  ].forEach((client) => insertClient.run(client));

  [
    {
      fullName: 'Алексей Петров',
      position: 'Консультант 1С',
      phone: '+7 701 400 40 40',
      email: 'petrov@helpdesk.local',
    },
    {
      fullName: 'Дана Ахметова',
      position: 'Разработчик 1С',
      phone: '+7 701 500 50 50',
      email: 'akhmetova@helpdesk.local',
    },
    {
      fullName: 'Сергей Волков',
      position: 'Специалист сопровождения',
      phone: '+7 701 600 60 60',
      email: 'volkov@helpdesk.local',
    },
  ].forEach((employee) => insertEmployee.run(employee));

  const clientsByName = getRowsByKey(db, 'clients', 'name');
  const employeesByEmail = getRowsByKey(db, 'employees', 'email');

  [
    {
      clientId: clientsByName.get('ТОО Альфа-Сервис').id,
      number: 'AS-2026-001',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      supportType: 'ИТС и консультации',
      tariff: 'Стандарт',
    },
    {
      clientId: clientsByName.get('ИП Нурланов').id,
      number: 'NR-2026-014',
      startDate: '2026-02-01',
      endDate: '2026-12-31',
      supportType: 'Абонентское сопровождение',
      tariff: 'Базовый',
    },
    {
      clientId: clientsByName.get('ТОО Восток-Трейд').id,
      number: 'VT-2026-008',
      startDate: '2026-03-15',
      endDate: '2027-03-14',
      supportType: 'Доработки и обновления',
      tariff: 'Расширенный',
    },
  ].forEach((contract) => insertContract.run(contract));

  const contractsByNumber = getRowsByKey(db, 'contracts', 'number');
  const statusesByCode = getRowsByKey(db, 'statuses', 'code');
  const categoriesByCode = getRowsByKey(db, 'categories', 'code');

  const insertTicket = db.prepare(`
    INSERT INTO tickets (
      contract_id,
      category_id,
      status_id,
      responsible_employee_id,
      subject,
      description,
      priority,
      created_at,
      deadline
    )
    SELECT
      @contractId,
      @categoryId,
      @statusId,
      @responsibleEmployeeId,
      @subject,
      @description,
      @priority,
      datetime('now', @createdOffset),
      date('now', @deadlineOffset)
    WHERE NOT EXISTS (
      SELECT 1 FROM tickets WHERE subject = @subject
    )
  `);

  [
    {
      contractId: contractsByNumber.get('AS-2026-001').id,
      categoryId: categoriesByCode.get('bug').id,
      statusId: statusesByCode.get('in_progress').id,
      responsibleEmployeeId: employeesByEmail.get('petrov@helpdesk.local').id,
      subject: 'Не открывается база 1С',
      description: 'После обновления платформа показывает ошибку подключения к информационной базе.',
      priority: 'urgent',
      createdOffset: '-8 days',
      deadlineOffset: '-2 days',
    },
    {
      contractId: contractsByNumber.get('VT-2026-008').id,
      categoryId: categoriesByCode.get('customization').id,
      statusId: statusesByCode.get('waiting_client').id,
      responsibleEmployeeId: employeesByEmail.get('akhmetova@helpdesk.local').id,
      subject: 'Настроить печатную форму счета',
      description: 'Добавить логотип, банковские реквизиты и подпись ответственного менеджера.',
      priority: 'high',
      createdOffset: '-5 days',
      deadlineOffset: '3 days',
    },
    {
      contractId: contractsByNumber.get('NR-2026-014').id,
      categoryId: categoriesByCode.get('update').id,
      statusId: statusesByCode.get('done').id,
      responsibleEmployeeId: employeesByEmail.get('volkov@helpdesk.local').id,
      subject: 'Обновить релиз бухгалтерии',
      description: 'Установить актуальный релиз конфигурации и проверить регламентированные отчеты.',
      priority: 'normal',
      createdOffset: '-12 days',
      deadlineOffset: '-7 days',
    },
    {
      contractId: contractsByNumber.get('AS-2026-001').id,
      categoryId: categoriesByCode.get('consultation').id,
      statusId: statusesByCode.get('closed').id,
      responsibleEmployeeId: employeesByEmail.get('petrov@helpdesk.local').id,
      subject: 'Консультация по закрытию месяца',
      description: 'Объяснить порядок проверки взаиморасчетов и перепроведения документов.',
      priority: 'low',
      createdOffset: '-20 days',
      deadlineOffset: '-18 days',
    },
  ].forEach((ticket) => insertTicket.run(ticket));

  seedWorkLogs(db, employeesByEmail);
}

function seedWorkLogs(db, employeesByEmail) {
  const ticketsBySubject = getRowsByKey(db, 'tickets', 'subject');
  const insertWorkLog = db.prepare(`
    INSERT INTO work_logs (ticket_id, employee_id, work_date, description, hours)
    SELECT @ticketId, @employeeId, date('now', @workDateOffset), @description, @hours
    WHERE NOT EXISTS (
      SELECT 1
      FROM work_logs
      WHERE ticket_id = @ticketId
        AND employee_id = @employeeId
        AND description = @description
    )
  `);

  [
    {
      ticketId: ticketsBySubject.get('Не открывается база 1С').id,
      employeeId: employeesByEmail.get('petrov@helpdesk.local').id,
      workDateOffset: '-7 days',
      description: 'Проверено подключение пользователей и журнал регистрации.',
      hours: 1.5,
    },
    {
      ticketId: ticketsBySubject.get('Не открывается база 1С').id,
      employeeId: employeesByEmail.get('akhmetova@helpdesk.local').id,
      workDateOffset: '-6 days',
      description: 'Найдена ошибка после обновления, подготовлен план исправления.',
      hours: 2,
    },
    {
      ticketId: ticketsBySubject.get('Настроить печатную форму счета').id,
      employeeId: employeesByEmail.get('akhmetova@helpdesk.local').id,
      workDateOffset: '-4 days',
      description: 'Собраны требования и подготовлен макет печатной формы.',
      hours: 2.5,
    },
    {
      ticketId: ticketsBySubject.get('Обновить релиз бухгалтерии').id,
      employeeId: employeesByEmail.get('volkov@helpdesk.local').id,
      workDateOffset: '-10 days',
      description: 'Выполнено обновление тестовой базы и проверка отчетности.',
      hours: 3,
    },
    {
      ticketId: ticketsBySubject.get('Консультация по закрытию месяца').id,
      employeeId: employeesByEmail.get('petrov@helpdesk.local').id,
      workDateOffset: '-19 days',
      description: 'Проведена консультация по закрытию месяца.',
      hours: 1,
    },
  ].forEach((workLog) => insertWorkLog.run(workLog));
}

function getRowsByKey(db, tableName, keyColumn) {
  const rows = db.prepare(`SELECT * FROM ${tableName}`).all();
  return new Map(rows.map((row) => [row[keyColumn], row]));
}
