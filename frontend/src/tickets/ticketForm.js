export const PRIORITY_LABELS = {
  high: 'Высокий',
  low: 'Низкий',
  normal: 'Обычный',
  urgent: 'Срочный',
};

export function buildTicketFields(meta, ticket = null) {
  if (!meta) {
    return [];
  }

  const defaultStatus = ticket
    ? String(ticket.statusId)
    : String(meta.statuses.find((status) => status.code === 'new')?.id || '');

  return [
    {
      defaultValue: ticket?.subject || '',
      label: 'Тема',
      name: 'subject',
      required: true,
    },
    {
      defaultValue: ticket?.contractId ? String(ticket.contractId) : '',
      label: 'Договор',
      name: 'contractId',
      options: meta.contracts.map((contract) => ({
        label: `${contract.number} · ${contract.clientName}`,
        value: String(contract.id),
      })),
      placeholder: 'Выберите договор',
      required: true,
      type: 'select',
    },
    {
      defaultValue: ticket?.categoryId ? String(ticket.categoryId) : '',
      label: 'Категория',
      name: 'categoryId',
      options: meta.categories.map((category) => ({
        label: category.name,
        value: String(category.id),
      })),
      placeholder: 'Выберите категорию',
      required: true,
      type: 'select',
    },
    {
      defaultValue: defaultStatus,
      label: 'Статус',
      name: 'statusId',
      options: meta.statuses.map((status) => ({
        label: status.name,
        value: String(status.id),
      })),
      placeholder: 'Выберите статус',
      required: true,
      type: 'select',
    },
    {
      defaultValue: ticket?.priority || '',
      label: 'Приоритет',
      name: 'priority',
      options: meta.priorities.map((priority) => ({
        label: PRIORITY_LABELS[priority.value],
        value: priority.value,
      })),
      placeholder: 'Выберите приоритет',
      required: true,
      type: 'select',
    },
    {
      defaultValue: ticket?.responsibleEmployeeId ? String(ticket.responsibleEmployeeId) : '',
      label: 'Исполнитель',
      name: 'responsibleEmployeeId',
      options: meta.employees.map((employee) => ({
        label: employee.fullName,
        value: String(employee.id),
      })),
      placeholder: 'Выберите исполнителя',
      required: true,
      type: 'select',
    },
    {
      defaultValue: ticket?.deadlineAt ? String(ticket.deadlineAt).slice(0, 10) : '',
      label: 'Дедлайн',
      name: 'deadlineAt',
      type: 'date',
    },
    {
      defaultValue: ticket?.description || '',
      label: 'Описание',
      name: 'description',
      type: 'textarea',
    },
  ];
}

export function buildWorkLogFields(meta, ticket = null) {
  if (!meta) {
    return [];
  }

  return [
    {
      defaultValue: ticket?.responsibleEmployeeId ? String(ticket.responsibleEmployeeId) : '',
      label: 'Исполнитель',
      name: 'employeeId',
      options: meta.employees.map((employee) => ({
        label: employee.fullName,
        value: String(employee.id),
      })),
      placeholder: 'Выберите исполнителя',
      required: true,
      type: 'select',
    },
    {
      defaultValue: new Date().toISOString().slice(0, 10),
      label: 'Дата работы',
      name: 'workDate',
      required: true,
      type: 'date',
    },
    {
      label: 'Часы',
      min: 0,
      name: 'hours',
      required: true,
      step: '0.5',
      type: 'number',
    },
    {
      label: 'Описание работы',
      name: 'description',
      required: true,
      type: 'textarea',
    },
  ];
}
