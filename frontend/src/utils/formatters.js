const DATE_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat('ru-RU', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const NUMBER_FORMATTER = new Intl.NumberFormat('ru-RU', {
  maximumFractionDigits: 1,
  minimumFractionDigits: 0,
});

function parseDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = parseDate(value);
  return date ? DATE_FORMATTER.format(date) : '—';
}

export function formatDateTime(value) {
  const date = parseDate(value);
  return date ? DATE_TIME_FORMATTER.format(date) : '—';
}

export function formatDeadline(value) {
  const date = parseDate(value);

  if (!date) {
    return '—';
  }

  const isOverdue = date.getTime() < Date.now();
  return `${DATE_TIME_FORMATTER.format(date)}${isOverdue ? ' · просрочено' : ''}`;
}

export function formatHours(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '—';
  }

  return `${NUMBER_FORMATTER.format(numericValue)} ч`;
}

export function formatNumber(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return '—';
  }

  return NUMBER_FORMATTER.format(numericValue);
}
