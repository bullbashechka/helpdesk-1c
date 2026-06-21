import { useEffect, useState } from 'react';

import { apiClient } from '../api/apiClient.js';
import { fetchDashboardSummary } from '../api/dashboardApi.js';
import { fetchHealth } from '../api/healthApi.js';
import { DataTable } from '../components/DataTable.jsx';
import { FormModal } from '../components/FormModal.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { ReportsPage } from './ReportsPage.jsx';
import { TicketListPage } from './TicketListPage.jsx';
import { WaInboxPage } from './WaInboxPage.jsx';
import { formatDate, formatDateTime, formatDeadline, formatNumber } from '../utils/formatters.js';

function normalizeRows(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.items)) {
    return payload.items;
  }

  if (Array.isArray(payload?.data)) {
    return payload.data;
  }

  return [];
}

function HealthPanel() {
  const [state, setState] = useState({ error: '', isLoading: true, value: null });

  useEffect(() => {
    let isMounted = true;

    fetchHealth()
      .then((value) => {
        if (isMounted) {
          setState({ error: '', isLoading: false, value });
        }
      })
      .catch((error) => {
        if (isMounted) {
          setState({ error: error.message, isLoading: false, value: null });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (state.isLoading) {
    return <LoadingState title="Проверяем API..." />;
  }

  if (state.error) {
    return <ErrorState message={state.error} />;
  }

  return (
    <div className="health-strip">
      <span className="status-dot status-dot--ok" aria-hidden="true" />
      <span>API доступен</span>
      <b>{state.value?.service}</b>
      <span>{formatDateTime(state.value?.timestamp)}</span>
    </div>
  );
}

function StatusBadge({ code, name }) {
  return <span className={`status-badge status-badge--${code}`}>{name || '—'}</span>;
}

function CountBarChart({ items, title }) {
  const maxCount = Math.max(...items.map((item) => Number(item.count) || 0), 1);

  return (
    <article className="chart-panel">
      <h3>{title}</h3>
      <div className="bar-chart">
        {items.map((item) => {
          const count = Number(item.count) || 0;
          const width = `${Math.max((count / maxCount) * 100, count > 0 ? 8 : 0)}%`;

          return (
            <div className="bar-row" key={item.code}>
              <div className="bar-row__label">
                <span>{item.name}</span>
                <b>{formatNumber(count)}</b>
              </div>
              <div className="bar-track" aria-label={`${item.name}: ${count}`}>
                <span className="bar-fill" style={{ width }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function RecentTicketsTable({ navigate, tickets }) {
  if (!tickets.length) {
    return (
      <EmptyState
        title="Последних заявок нет"
        description="После создания или импорта заявки появятся в этой сводке."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table recent-tickets-table">
        <thead>
          <tr>
            <th scope="col">Тема</th>
            <th scope="col">Клиент</th>
            <th scope="col">Статус</th>
            <th scope="col">Создана</th>
            <th scope="col">Дедлайн</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr
              className="clickable-row"
              key={ticket.id}
              onClick={() => navigate(`/tickets/${ticket.id}`)}
            >
              <td>
                <button
                  className="link-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(`/tickets/${ticket.id}`);
                  }}
                  type="button"
                >
                  {ticket.subject}
                </button>
              </td>
              <td>{ticket.clientName}</td>
              <td><StatusBadge code={ticket.statusCode} name={ticket.statusName} /></td>
              <td>{formatDate(ticket.createdAt)}</td>
              <td>{formatDeadline(ticket.deadlineAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashboardPage({ navigate, page }) {
  const [state, setState] = useState({ data: null, error: '', isLoading: true });

  async function loadDashboard() {
    setState((currentState) => ({ ...currentState, error: '', isLoading: true }));

    try {
      const data = await fetchDashboardSummary();
      setState({ data, error: '', isLoading: false });
    } catch (error) {
      setState({ data: null, error: error.message, isLoading: false });
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const statuses = state.data?.statuses || [];
  const categories = state.data?.categories || [];
  const totals = state.data?.totals || { overdueTickets: 0, totalTickets: 0 };
  const metricCards = [
    { label: 'Всего заявок', value: totals.totalTickets },
    { label: 'Просрочено', value: totals.overdueTickets, tone: 'danger' },
    ...statuses.map((status) => ({
      label: status.name,
      value: status.count,
    })),
  ];

  return (
    <section className="page">
      <div className="page-heading">
        <p className="section-label">{page.kicker}</p>
        <h2>{page.title}</h2>
        <p>{page.description}</p>
      </div>

      {state.isLoading ? <LoadingState /> : null}

      {!state.isLoading && state.error ? (
        <ErrorState message={state.error} onRetry={loadDashboard} />
      ) : null}

      {!state.isLoading && !state.error && state.data ? (
        <>
          <div className="metrics-grid metrics-grid--dashboard">
            {metricCards.map((metric) => (
              <article
                className={`metric-card ${metric.tone ? `metric-card--${metric.tone}` : ''}`}
                key={metric.label}
              >
                <span>{metric.label}</span>
                <strong>{formatNumber(metric.value)}</strong>
              </article>
            ))}
          </div>

          <div className="dashboard-grid">
            <CountBarChart items={statuses} title="Распределение по статусам" />
            <CountBarChart items={categories} title="Распределение по категориям" />
          </div>

          <section className="dashboard-section">
            <div className="section-heading">
              <h3>Последние заявки</h3>
            </div>
            <RecentTicketsTable navigate={navigate} tickets={state.data.recentTickets || []} />
          </section>

          <HealthPanel />
        </>
      ) : null}
    </section>
  );
}

export function ResourcePage({ navigate, page }) {
  const [rows, setRows] = useState([]);
  const [dependencies, setDependencies] = useState({});
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(Boolean(page.endpoint));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [formError, setFormError] = useState('');

  async function fetchRows() {
    if (!page.endpoint) {
      return [];
    }

    const payload = await apiClient.get(page.endpoint);
    return normalizeRows(payload);
  }

  async function fetchDependencies() {
    if (!page.optionSources) {
      return {};
    }

    const entries = await Promise.all(
      Object.entries(page.optionSources).map(async ([key, endpoint]) => {
        const payload = await apiClient.get(endpoint);
        return [key, normalizeRows(payload)];
      }),
    );

    return Object.fromEntries(entries);
  }

  async function loadPageData() {
    setIsLoading(true);
    setError('');

    try {
      const [nextRows, nextDependencies] = await Promise.all([fetchRows(), fetchDependencies()]);
      setRows(nextRows);
      setDependencies(nextDependencies);
    } catch (loadError) {
      setRows([]);
      setDependencies({});
      setError(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }

  async function loadRows() {
    try {
      setRows(await fetchRows());
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    loadPageData();
  }, [page.endpoint]);

  const formFields = page.buildFormFields
    ? page.buildFormFields({ dependencies, row: editingRow })
    : (page.formFields || []).map((field) => ({
        ...field,
        defaultValue: editingRow?.[field.name] ?? field.defaultValue ?? '',
      }));

  function closeModal() {
    setIsModalOpen(false);
    setEditingRow(null);
    setFormError('');
  }

  function openCreateModal() {
    setEditingRow(null);
    setFormError('');
    setIsModalOpen(true);
  }

  function openEditModal(row) {
    setEditingRow(row);
    setFormError('');
    setIsModalOpen(true);
  }

  async function handleSubmit(values) {
    if (!page.endpoint) {
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      if (editingRow?.id) {
        await apiClient.put(`${page.endpoint}/${editingRow.id}`, values);
      } else {
        await apiClient.post(page.endpoint, values);
      }

      closeModal();
      await loadRows();
    } catch (saveError) {
      setFormError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(row) {
    if (!page.endpoint || !window.confirm(page.deleteConfirm || 'Удалить запись?')) {
      return;
    }

    setError('');

    try {
      await apiClient.delete(`${page.endpoint}/${row.id}`);
      await loadRows();
    } catch (deleteError) {
      setError(deleteError.message);
    }
  }

  if (page.type === 'dashboard') {
    return <DashboardPage navigate={navigate} page={page} />;
  }

  if (page.type === 'tickets') {
    return <TicketListPage navigate={navigate} page={page} />;
  }

  if (page.type === 'reports') {
    return <ReportsPage page={page} />;
  }

  if (page.type === 'wa-inbox') {
    return <WaInboxPage page={page} />;
  }

  return (
    <section className="page">
      <div className="page-heading page-heading--with-action">
        <div>
          <p className="section-label">{page.kicker}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
        </div>

        {formFields.length ? (
          <button className="button" onClick={openCreateModal} type="button">
            Новая запись
          </button>
        ) : null}
      </div>

      {isLoading ? <LoadingState /> : null}

      {!isLoading && error ? <ErrorState message={error} onRetry={loadRows} /> : null}

      {!isLoading && !error ? (
        <DataTable
          actions={[
            { label: 'Редактировать', onClick: openEditModal },
            { label: 'Удалить', onClick: handleDelete, tone: 'danger' },
          ]}
          columns={page.columns}
          emptyDescription={page.emptyDescription}
          emptyTitle={page.emptyTitle}
          rows={rows}
        />
      ) : null}

      <FormModal
        error={formError}
        fields={formFields}
        isOpen={isModalOpen}
        isSaving={isSaving}
        onClose={closeModal}
        onSubmit={handleSubmit}
        title={editingRow ? page.editTitle : page.createTitle}
      />
    </section>
  );
}
