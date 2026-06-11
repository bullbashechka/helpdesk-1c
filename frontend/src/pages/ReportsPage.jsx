import { useState } from 'react';

import { fetchEmployeeHoursReport, fetchTicketsReport } from '../api/reportsApi.js';
import { DataTable } from '../components/DataTable.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { PRIORITY_LABELS } from '../tickets/ticketForm.js';
import { formatDate, formatDeadline, formatHours } from '../utils/formatters.js';
import { buildCsv, downloadCsv } from '../utils/csv.js';

const TICKETS_COLUMNS = [
  { key: 'number', label: 'Номер' },
  { key: 'subject', label: 'Тема' },
  { key: 'clientName', label: 'Клиент' },
  { key: 'contractNumber', label: 'Договор' },
  { key: 'categoryName', label: 'Категория' },
  { key: 'statusName', label: 'Статус' },
  { key: 'priority', label: 'Приоритет', render: (row) => PRIORITY_LABELS[row.priority] || row.priority },
  { key: 'createdAt', label: 'Создана', render: (row) => formatDate(row.createdAt) },
  { key: 'deadlineAt', label: 'Дедлайн', render: (row) => formatDeadline(row.deadlineAt) },
  { key: 'assigneeName', label: 'Исполнитель' },
  { key: 'spentHours', label: 'Часы', render: (row) => formatHours(row.spentHours) },
];

const EMPLOYEE_HOURS_COLUMNS = [
  { key: 'employeeName', label: 'Сотрудник' },
  { key: 'position', label: 'Роль' },
  { key: 'workLogsCount', label: 'Записей работ' },
  { key: 'totalHours', label: 'Часы', render: (row) => formatHours(row.totalHours) },
];

const TICKETS_CSV_COLUMNS = [
  TICKETS_COLUMNS[0],
  TICKETS_COLUMNS[1],
  TICKETS_COLUMNS[2],
  TICKETS_COLUMNS[3],
  TICKETS_COLUMNS[4],
  TICKETS_COLUMNS[5],
  { key: 'priority', label: 'Приоритет', getValue: (row) => PRIORITY_LABELS[row.priority] || row.priority },
  { key: 'createdAt', label: 'Создана', getValue: (row) => formatDate(row.createdAt) },
  { key: 'deadlineAt', label: 'Дедлайн', getValue: (row) => formatDeadline(row.deadlineAt) },
  TICKETS_COLUMNS[9],
  { key: 'spentHours', label: 'Часы', getValue: (row) => row.spentHours },
];

const EMPLOYEE_HOURS_CSV_COLUMNS = [
  EMPLOYEE_HOURS_COLUMNS[0],
  EMPLOYEE_HOURS_COLUMNS[1],
  EMPLOYEE_HOURS_COLUMNS[2],
  { key: 'totalHours', label: 'Часы', getValue: (row) => row.totalHours },
];

function ReportCard({ children, title, description, actions }) {
  return (
    <section className="report-card">
      <div className="section-heading">
        <div>
          <h3>{title}</h3>
          <p className="report-card__description">{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function DateRangeFields({ dateFrom, dateTo, onDateFromChange, onDateToChange }) {
  return (
    <div className="report-filters">
      <label className="field field--compact">
        <span>От</span>
        <input onChange={(event) => onDateFromChange(event.target.value)} type="date" value={dateFrom} />
      </label>
      <label className="field field--compact">
        <span>До</span>
        <input onChange={(event) => onDateToChange(event.target.value)} type="date" value={dateTo} />
      </label>
    </div>
  );
}

export function ReportsPage({ page }) {
  const [ticketsFilters, setTicketsFilters] = useState({ dateFrom: '', dateTo: '' });
  const [hoursFilters, setHoursFilters] = useState({ dateFrom: '', dateTo: '' });
  const [ticketsState, setTicketsState] = useState({ error: '', isLoading: false, rows: [] });
  const [hoursState, setHoursState] = useState({ error: '', isLoading: false, rows: [] });

  async function loadTicketsReport() {
    setTicketsState((currentState) => ({ ...currentState, error: '', isLoading: true }));

    try {
      const payload = await fetchTicketsReport(ticketsFilters);
      setTicketsState({
        error: '',
        isLoading: false,
        rows: Array.isArray(payload?.items) ? payload.items : [],
      });
    } catch (error) {
      setTicketsState({ error: error.message, isLoading: false, rows: [] });
    }
  }

  async function loadHoursReport() {
    setHoursState((currentState) => ({ ...currentState, error: '', isLoading: true }));

    try {
      const payload = await fetchEmployeeHoursReport(hoursFilters);
      setHoursState({
        error: '',
        isLoading: false,
        rows: Array.isArray(payload?.items) ? payload.items : [],
      });
    } catch (error) {
      setHoursState({ error: error.message, isLoading: false, rows: [] });
    }
  }

  function exportTicketsCsv() {
    const csv = buildCsv(TICKETS_CSV_COLUMNS, ticketsState.rows);
    downloadCsv('tickets-report.csv', csv);
  }

  function exportHoursCsv() {
    const csv = buildCsv(EMPLOYEE_HOURS_CSV_COLUMNS, hoursState.rows);
    downloadCsv('employee-hours-report.csv', csv);
  }

  return (
    <section className="page">
      <div className="page-heading">
        <p className="section-label">{page.kicker}</p>
        <h2>{page.title}</h2>
        <p>{page.description}</p>
      </div>

      <ReportCard
        actions={(
          <div className="page-actions">
            <button className="button button--secondary" onClick={exportTicketsCsv} disabled={!ticketsState.rows.length} type="button">
              Экспорт CSV
            </button>
            <button className="button" onClick={loadTicketsReport} type="button">
              Сформировать
            </button>
          </div>
        )}
        description="Выборка заявок по дате создания за указанный период."
        title="Заявки за период"
      >
        <DateRangeFields
          dateFrom={ticketsFilters.dateFrom}
          dateTo={ticketsFilters.dateTo}
          onDateFromChange={(value) => setTicketsFilters((current) => ({ ...current, dateFrom: value }))}
          onDateToChange={(value) => setTicketsFilters((current) => ({ ...current, dateTo: value }))}
        />

        {ticketsState.isLoading ? <LoadingState title="Формируем отчет по заявкам..." /> : null}
        {!ticketsState.isLoading && ticketsState.error ? (
          <ErrorState message={ticketsState.error} onRetry={loadTicketsReport} />
        ) : null}
        {!ticketsState.isLoading && !ticketsState.error ? (
          <DataTable
            columns={TICKETS_COLUMNS}
            emptyDescription="Укажите период и сформируйте отчет. Если диапазон пустой, будут показаны все заявки."
            emptyTitle="Нет данных по заявкам"
            rows={ticketsState.rows}
          />
        ) : null}
      </ReportCard>

      <ReportCard
        actions={(
          <div className="page-actions">
            <button className="button button--secondary" onClick={exportHoursCsv} disabled={!hoursState.rows.length} type="button">
              Экспорт CSV
            </button>
            <button className="button" onClick={loadHoursReport} type="button">
              Сформировать
            </button>
          </div>
        )}
        description="Суммарные часы по записям работ сотрудников с необязательным ограничением периодом."
        title="Часы по сотрудникам"
      >
        <DateRangeFields
          dateFrom={hoursFilters.dateFrom}
          dateTo={hoursFilters.dateTo}
          onDateFromChange={(value) => setHoursFilters((current) => ({ ...current, dateFrom: value }))}
          onDateToChange={(value) => setHoursFilters((current) => ({ ...current, dateTo: value }))}
        />

        {hoursState.isLoading ? <LoadingState title="Считаем часы по сотрудникам..." /> : null}
        {!hoursState.isLoading && hoursState.error ? (
          <ErrorState message={hoursState.error} onRetry={loadHoursReport} />
        ) : null}
        {!hoursState.isLoading && !hoursState.error ? (
          <DataTable
            columns={EMPLOYEE_HOURS_COLUMNS}
            emptyDescription="Сформируйте отчет без периода или укажите диапазон дат записей работ."
            emptyTitle="Нет данных по часам"
            rows={hoursState.rows}
          />
        ) : null}
      </ReportCard>
    </section>
  );
}
