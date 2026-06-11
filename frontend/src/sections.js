import { formatDate, formatDeadline, formatHours } from './utils/formatters.js';

export const dashboardPage = {
  description: 'Сводка по заявкам, просроченным дедлайнам, статусам и категориям.',
  icon: 'dashboard',
  kicker: 'Дашборд',
  path: '/dashboard',
  shortLabel: 'Д',
  title: 'Дашборд',
  type: 'dashboard',
};

const ticketColumns = [
  { key: 'number', label: 'Номер' },
  { key: 'title', label: 'Тема' },
  { key: 'clientName', label: 'Клиент' },
  { key: 'assigneeName', label: 'Исполнитель' },
  { key: 'statusName', label: 'Статус' },
  { key: 'deadlineAt', label: 'Дедлайн', render: (row) => formatDeadline(row.deadlineAt) },
  { key: 'spentHours', label: 'Часы', render: (row) => formatHours(row.spentHours) },
];

function withRowDefault(field, row) {
  return {
    ...field,
    defaultValue: row?.[field.name] ?? field.defaultValue ?? '',
  };
}

const clientFields = [
  { label: 'Наименование', name: 'name', required: true },
  { label: 'БИН/ИИН', name: 'taxId' },
  { label: 'Контактное лицо', name: 'contactPerson' },
  { label: 'Телефон', name: 'phone', type: 'tel' },
  { label: 'Email', name: 'email', type: 'email' },
  { label: 'Адрес', name: 'address', type: 'textarea' },
];

const employeeFields = [
  { label: 'ФИО', name: 'fullName', required: true },
  { label: 'Должность', name: 'position' },
  { label: 'Телефон', name: 'phone', type: 'tel' },
  { label: 'Email', name: 'email', type: 'email' },
];

export const resourcePages = [
  {
    columns: ticketColumns,
    description: 'Очередь обращений, поиск по теме и описанию, контроль просроченных заявок.',
    emptyDescription: 'Заявки появятся здесь после создания или импорта из backend.',
    emptyTitle: 'Заявок нет',
    endpoint: '/tickets',
    icon: 'tickets',
    kicker: 'Работа',
    path: '/tickets',
    shortLabel: 'З',
    title: 'Заявки',
    type: 'tickets',
  },
  {
    buildFormFields: ({ row }) => clientFields.map((field) => withRowDefault(field, row)),
    columns: [
      { key: 'name', label: 'Клиент' },
      { key: 'taxId', label: 'БИН/ИИН' },
      { key: 'contactPerson', label: 'Контакт' },
      { key: 'phone', label: 'Телефон' },
      { key: 'email', label: 'Email' },
      { key: 'createdAt', label: 'Создан', render: (row) => formatDate(row.createdAt) },
    ],
    createTitle: 'Новый клиент',
    deleteConfirm: 'Удалить клиента? Это возможно только если у него нет договоров.',
    description: 'Компании и контактные лица для обслуживания.',
    editTitle: 'Редактировать клиента',
    emptyDescription: 'Клиенты появятся здесь после создания первой записи.',
    emptyTitle: 'Клиентов нет',
    endpoint: '/clients',
    formFields: clientFields,
    icon: 'clients',
    kicker: 'Справочник',
    path: '/clients',
    shortLabel: 'К',
    title: 'Клиенты',
  },
  {
    buildFormFields: ({ dependencies, row }) => [
      {
        defaultValue: row?.clientId ? String(row.clientId) : '',
        label: 'Клиент',
        name: 'clientId',
        options: (dependencies.clients || []).map((client) => ({
          label: client.name,
          value: String(client.id),
        })),
        placeholder: 'Выберите клиента',
        required: true,
        type: 'select',
      },
      { defaultValue: row?.number || '', label: 'Номер', name: 'number', required: true },
      { defaultValue: row?.startDate || '', label: 'Дата начала', name: 'startDate', type: 'date' },
      { defaultValue: row?.endDate || '', label: 'Дата окончания', name: 'endDate', type: 'date' },
      { defaultValue: row?.supportType || '', label: 'Тип сопровождения', name: 'supportType' },
      { defaultValue: row?.tariff || '', label: 'Тариф', name: 'tariff' },
    ],
    columns: [
      { key: 'number', label: 'Договор' },
      { key: 'clientName', label: 'Клиент' },
      { key: 'startDate', label: 'Начало', render: (row) => formatDate(row.startDate) },
      { key: 'endDate', label: 'Окончание', render: (row) => formatDate(row.endDate) },
      { key: 'supportType', label: 'Тип сопровождения' },
      { key: 'tariff', label: 'Тариф' },
    ],
    createTitle: 'Новый договор',
    deleteConfirm: 'Удалить договор? Это возможно только если по нему нет заявок.',
    description: 'Условия обслуживания, сроки, тарифы и привязка к клиентам.',
    editTitle: 'Редактировать договор',
    emptyDescription: 'Договоры появятся здесь после создания первой записи.',
    emptyTitle: 'Договоров нет',
    endpoint: '/contracts',
    formFields: [{}],
    icon: 'contracts',
    kicker: 'Справочник',
    optionSources: {
      clients: '/clients',
    },
    path: '/contracts',
    shortLabel: 'ДГ',
    title: 'Договоры',
  },
  {
    buildFormFields: ({ row }) => employeeFields.map((field) => withRowDefault(field, row)),
    columns: [
      { key: 'fullName', label: 'Сотрудник' },
      { key: 'position', label: 'Должность' },
      { key: 'phone', label: 'Телефон' },
      { key: 'email', label: 'Email' },
      { key: 'activeTickets', label: 'Заявки' },
      { key: 'workLogs', label: 'Работы' },
    ],
    createTitle: 'Новый сотрудник',
    deleteConfirm: 'Удалить сотрудника? Это возможно только если он не связан с заявками и работами.',
    description: 'Исполнители и диспетчеры, участвующие в обработке заявок.',
    editTitle: 'Редактировать сотрудника',
    emptyDescription: 'Сотрудники появятся здесь после создания записей.',
    emptyTitle: 'Сотрудников нет',
    endpoint: '/employees',
    formFields: employeeFields,
    icon: 'employees',
    kicker: 'Команда',
    path: '/employees',
    shortLabel: 'С',
    title: 'Сотрудники',
  },
  {
    description: 'Периодические отчеты по заявкам и часам сотрудников с CSV-экспортом.',
    icon: 'reports',
    kicker: 'Аналитика',
    path: '/reports',
    shortLabel: 'О',
    title: 'Отчеты',
    type: 'reports',
  },
];

export const navigationItems = [dashboardPage, ...resourcePages];
