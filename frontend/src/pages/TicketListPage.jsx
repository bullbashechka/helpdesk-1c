import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';

import { createTicket, fetchTicketMeta, fetchTickets } from '../api/ticketsApi.js';
import { FormModal } from '../components/FormModal.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { buildTicketFields, PRIORITY_LABELS } from '../tickets/ticketForm.js';
import { formatDate, formatDeadline } from '../utils/formatters.js';

function StatusBadge({ code, name }) {
  return <span className={`status-badge status-badge--${code}`}>{name || '—'}</span>;
}

function PriorityBadge({ priority }) {
  return <span className={`priority-badge priority-badge--${priority}`}>{PRIORITY_LABELS[priority] || priority}</span>;
}

function TicketTable({ navigate, rows }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Подходящих заявок нет"
        description="Измените строку поиска, снимите фильтр просроченных или создайте новую заявку."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table ticket-table">
        <thead>
          <tr>
            <th scope="col">Тема</th>
            <th scope="col">Клиент</th>
            <th scope="col">Категория</th>
            <th scope="col">Статус</th>
            <th scope="col">Приоритет</th>
            <th scope="col">Создана</th>
            <th scope="col">Дедлайн</th>
            <th scope="col">Исполнитель</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ticket) => (
            <tr
              className={`clickable-row ${ticket.isOverdue ? 'ticket-row--overdue' : ''}`}
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
              <td>{ticket.categoryName}</td>
              <td><StatusBadge code={ticket.statusCode} name={ticket.statusName} /></td>
              <td><PriorityBadge priority={ticket.priority} /></td>
              <td>{formatDate(ticket.createdAt)}</td>
              <td>{formatDeadline(ticket.deadlineAt)}</td>
              <td>{ticket.assigneeName}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TicketListPage({ navigate, page }) {
  const [search, setSearch] = useState('');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [tableState, setTableState] = useState({ error: '', isLoading: true, rows: [] });
  const [metaState, setMetaState] = useState({ data: null, error: '', isLoading: true });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const deferredSearch = useDeferredValue(search);
  const ticketsRequestIdRef = useRef(0);
  const metaRequestIdRef = useRef(0);

  async function loadMeta() {
    const requestId = metaRequestIdRef.current + 1;
    metaRequestIdRef.current = requestId;
    setMetaState((currentState) => ({ ...currentState, error: '', isLoading: true }));

    try {
      const data = await fetchTicketMeta();

      if (metaRequestIdRef.current === requestId) {
        setMetaState({ data, error: '', isLoading: false });
      }
    } catch (error) {
      if (metaRequestIdRef.current === requestId) {
        setMetaState({ data: null, error: error.message, isLoading: false });
      }
    }
  }

  async function loadTickets(currentSearch, currentOverdue) {
    const requestId = ticketsRequestIdRef.current + 1;
    ticketsRequestIdRef.current = requestId;
    setTableState((currentState) => ({ ...currentState, error: '', isLoading: true }));

    try {
      const payload = await fetchTickets({
        overdue: currentOverdue ? '1' : '',
        q: currentSearch.trim(),
      });

      if (ticketsRequestIdRef.current === requestId) {
        setTableState({
          error: '',
          isLoading: false,
          rows: Array.isArray(payload?.items) ? payload.items : [],
        });
      }
    } catch (error) {
      if (ticketsRequestIdRef.current === requestId) {
        setTableState({ error: error.message, isLoading: false, rows: [] });
      }
    }
  }

  useEffect(() => {
    loadMeta();
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      loadTickets(deferredSearch, overdueOnly);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [deferredSearch, overdueOnly]);

  const formFields = useMemo(() => {
    return buildTicketFields(metaState.data);
  }, [metaState.data]);

  async function handleCreate(values) {
    setIsSaving(true);
    setFormError('');

    try {
      await createTicket(values);
      setIsModalOpen(false);
      await loadTickets(deferredSearch, overdueOnly);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="page">
      <div className="page-heading page-heading--with-action">
        <div>
          <p className="section-label">{page.kicker}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
        </div>

        <button
          className="button"
          disabled={metaState.isLoading || Boolean(metaState.error)}
          onClick={() => {
            setFormError('');
            setIsModalOpen(true);
          }}
          type="button"
        >
          Новая заявка
        </button>
      </div>

      <section className="filters-panel">
        <label className="field field--compact">
          <span>Поиск</span>
          <input
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Тема или описание"
            type="search"
            value={search}
          />
        </label>

        <label className="checkbox-field">
          <input
            checked={overdueOnly}
            onChange={(event) => setOverdueOnly(event.target.checked)}
            type="checkbox"
          />
          <span>Только просроченные</span>
        </label>
      </section>

      {metaState.error ? <ErrorState message={metaState.error} onRetry={loadMeta} /> : null}

      {tableState.isLoading ? <LoadingState title="Загружаем заявки..." /> : null}

      {!tableState.isLoading && tableState.error ? (
        <ErrorState
          message={tableState.error}
          onRetry={() => loadTickets(deferredSearch, overdueOnly)}
        />
      ) : null}

      {!tableState.isLoading && !tableState.error ? (
        <TicketTable navigate={navigate} rows={tableState.rows} />
      ) : null}

      <FormModal
        error={formError}
        fields={formFields}
        isOpen={isModalOpen}
        isSaving={isSaving}
        onClose={() => {
          setIsModalOpen(false);
          setFormError('');
        }}
        onSubmit={handleCreate}
        title="Новая заявка"
      />
    </section>
  );
}
