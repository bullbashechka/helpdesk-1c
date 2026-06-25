import { useEffect, useMemo, useState } from 'react';

import { addTicketWorkLog, fetchTicket, fetchTicketMeta, updateTicket } from '../api/ticketsApi.js';
import { FormModal } from '../components/FormModal.jsx';
import { ErrorState, LoadingState } from '../components/States.jsx';
import { buildTicketFields, buildWorkLogFields, PRIORITY_LABELS } from '../tickets/ticketForm.js';
import { formatDate, formatDateTime, formatDeadline, formatHours } from '../utils/formatters.js';

function DetailItem({ label, value }) {
  return (
    <div className="detail-item">
      <span>{label}</span>
      <b>{value || '—'}</b>
    </div>
  );
}

function StatusBadge({ code, name }) {
  return <span className={`status-badge status-badge--${code}`}>{name || '—'}</span>;
}

export function TicketDetailPage({ navigate, ticketId }) {
  const [state, setState] = useState({ error: '', isLoading: true, ticket: null });
  const [metaState, setMetaState] = useState({ data: null, error: '', isLoading: true });
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isWorkLogOpen, setIsWorkLogOpen] = useState(false);
  const [isSavingTicket, setIsSavingTicket] = useState(false);
  const [isSavingWorkLog, setIsSavingWorkLog] = useState(false);
  const [editError, setEditError] = useState('');
  const [workLogError, setWorkLogError] = useState('');

  async function loadTicket() {
    setState((currentState) => ({ ...currentState, error: '', isLoading: true }));

    try {
      const ticket = await fetchTicket(ticketId);
      setState({ error: '', isLoading: false, ticket });
    } catch (error) {
      setState({ error: error.message, isLoading: false, ticket: null });
    }
  }

  async function loadMeta() {
    setMetaState((currentState) => ({ ...currentState, error: '', isLoading: true }));

    try {
      const data = await fetchTicketMeta();
      setMetaState({ data, error: '', isLoading: false });
    } catch (error) {
      setMetaState({ data: null, error: error.message, isLoading: false });
    }
  }

  useEffect(() => {
    loadTicket();
    loadMeta();
  }, [ticketId]);

  const ticket = state.ticket;
  const editFields = useMemo(() => buildTicketFields(metaState.data, ticket), [metaState.data, ticket]);
  const workLogFields = useMemo(() => buildWorkLogFields(metaState.data, ticket), [metaState.data, ticket]);

  if (state.isLoading) {
    return <LoadingState title="Загружаем заявку..." />;
  }

  if (state.error || metaState.error) {
    return (
      <ErrorState
        message={state.error || metaState.error}
        onRetry={() => {
          loadTicket();
          loadMeta();
        }}
      />
    );
  }

  async function handleUpdateTicket(values) {
    setIsSavingTicket(true);
    setEditError('');

    try {
      const updatedTicket = await updateTicket(ticket.id, values);
      setState({ error: '', isLoading: false, ticket: updatedTicket });
      setIsEditOpen(false);
    } catch (error) {
      setEditError(error.message);
    } finally {
      setIsSavingTicket(false);
    }
  }

  async function handleAddWorkLog(values) {
    setIsSavingWorkLog(true);
    setWorkLogError('');

    try {
      const updatedTicket = await addTicketWorkLog(ticket.id, values);
      setState({ error: '', isLoading: false, ticket: updatedTicket });
      setIsWorkLogOpen(false);
    } catch (error) {
      setWorkLogError(error.message);
    } finally {
      setIsSavingWorkLog(false);
    }
  }

  return (
    <section className="page">
      <div className="page-heading page-heading--with-action">
        <div>
          <p className="section-label">Заявка #{ticket.id}</p>
          <h2>{ticket.subject}</h2>
          <p>{ticket.description || 'Описание не заполнено.'}</p>
        </div>

        <div className="page-actions">
          <button
            className="button button--secondary"
            disabled={metaState.isLoading}
            onClick={() => {
              setEditError('');
              setIsEditOpen(true);
            }}
            type="button"
          >
            Изменить
          </button>
          <button className="button button--secondary" onClick={() => navigate('/tickets')} type="button">
            К заявкам
          </button>
        </div>
      </div>

      <div className="ticket-card">
        <div className="ticket-card__status">
          <StatusBadge code={ticket.statusCode} name={ticket.statusName} />
          <span>{PRIORITY_LABELS[ticket.priority] || ticket.priority}</span>
        </div>

        <div className="details-grid">
          <DetailItem label="Клиент" value={ticket.clientName} />
          <DetailItem label="Договор" value={ticket.contractNumber} />
          <DetailItem label="Категория" value={ticket.categoryName} />
          <DetailItem label="Статус" value={ticket.statusName} />
          <DetailItem label="Ответственный" value={ticket.assigneeName} />
          <DetailItem label="Приоритет" value={PRIORITY_LABELS[ticket.priority] || ticket.priority} />
          <DetailItem label="Создана" value={formatDateTime(ticket.createdAt)} />
          <DetailItem label="Дедлайн" value={formatDeadline(ticket.deadlineAt)} />
          <DetailItem label="Часы по работам" value={formatHours(ticket.spentHours)} />
        </div>
      </div>

      <section className="dashboard-section">
        <div className="section-heading">
          <h3>Работы по заявке</h3>
          <button
            className="button button--secondary"
            disabled={metaState.isLoading}
            onClick={() => {
              setWorkLogError('');
              setIsWorkLogOpen(true);
            }}
            type="button"
          >
            Добавить работу
          </button>
        </div>

        {ticket.workLogs?.length ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Дата</th>
                  <th scope="col">Сотрудник</th>
                  <th scope="col">Описание</th>
                  <th scope="col">Часы</th>
                </tr>
              </thead>
              <tbody>
                {ticket.workLogs.map((workLog) => (
                  <tr key={workLog.id}>
                    <td>{formatDate(workLog.workDate)}</td>
                    <td>{workLog.employeeName}</td>
                    <td>{workLog.description}</td>
                    <td>{formatHours(workLog.hours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="state state--empty">
            <h2>Работ пока нет</h2>
            <p>В карточке появятся добавленные трудозатраты по заявке.</p>
          </div>
        )}
      </section>

      <FormModal
        error={editError}
        fields={editFields}
        isOpen={isEditOpen}
        isSaving={isSavingTicket}
        onClose={() => {
          setIsEditOpen(false);
          setEditError('');
        }}
        onSubmit={handleUpdateTicket}
        submitLabel="Сохранить изменения"
        title={`Изменить заявку #${ticket.id}`}
      />

      <FormModal
        error={workLogError}
        fields={workLogFields}
        isOpen={isWorkLogOpen}
        isSaving={isSavingWorkLog}
        onClose={() => {
          setIsWorkLogOpen(false);
          setWorkLogError('');
        }}
        onSubmit={handleAddWorkLog}
        submitLabel="Добавить работу"
        title="Новая запись о работе"
      />
    </section>
  );
}
