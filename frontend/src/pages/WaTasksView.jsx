import { useEffect, useRef, useState } from 'react';

import { fetchWaTasks, fetchWaTasksSummary, fetchWaTask, updateWaTask } from '../api/whatsappApi.js';
import { AttachmentList } from '../components/AttachmentList.jsx';
import { FormModal } from '../components/FormModal.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { formatDateTime } from '../utils/formatters.js';

const TASK_STATUS_OPTIONS = [
  { label: 'Новая', value: 'new' },
  { label: 'В работе', value: 'in_progress' },
  { label: 'Выполнена', value: 'done' },
  { label: 'Закрыта', value: 'closed' },
];

const TASK_STATUS_LABELS = {
  new: 'Новая',
  in_progress: 'В работе',
  done: 'Выполнена',
  closed: 'Закрыта',
};

const PRIORITY_OPTIONS = [
  { label: 'Низкий', value: 'low' },
  { label: 'Обычный', value: 'normal' },
  { label: 'Высокий', value: 'high' },
  { label: 'Срочный', value: 'urgent' },
];

const PRIORITY_LABELS = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
};

const FILTER_TABS = [
  { label: 'Все', value: null },
  { label: 'Новые', value: 'new' },
  { label: 'В работе', value: 'in_progress' },
  { label: 'Выполнены', value: 'done' },
  { label: 'Закрыты', value: 'closed' },
];

const PAGE_SIZE = 50;

function TaskStatusBadge({ status }) {
  return (
    <span className={`status-badge status-badge--wa-task-${status}`}>
      {TASK_STATUS_LABELS[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  return (
    <span className={`priority-badge priority-badge--${priority}`}>
      {PRIORITY_LABELS[priority] ?? priority}
    </span>
  );
}

function TaskTable({ rows, onRowClick }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Задач нет"
        description="Задачи из WhatsApp появятся здесь после создания из сообщений."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Тема</th>
            <th scope="col">Клиент</th>
            <th scope="col">Приоритет</th>
            <th scope="col">Статус</th>
            <th scope="col">Создана</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((task) => (
            <tr
              key={task.id}
              className="clickable-row"
              onClick={() => onRowClick(task.id)}
            >
              <td>{task.subject}</td>
              <td>
                {task.clientName ? (
                  <span>{task.clientName}</span>
                ) : (
                  <span className="wa-unrecognized-chip">
                    {task.senderName || task.senderPhone || '—'}
                  </span>
                )}
              </td>
              <td><PriorityBadge priority={task.priority} /></td>
              <td><TaskStatusBadge status={task.status} /></td>
              <td className="wa-date-cell">{formatDateTime(task.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function buildEditFields(task) {
  return [
    {
      name: 'subject',
      label: 'Тема',
      required: true,
      defaultValue: task.subject ?? '',
    },
    {
      name: 'priority',
      label: 'Приоритет',
      type: 'select',
      options: PRIORITY_OPTIONS,
      defaultValue: task.priority ?? 'normal',
    },
    {
      name: 'status',
      label: 'Статус',
      type: 'select',
      options: TASK_STATUS_OPTIONS,
      defaultValue: task.status ?? 'new',
    },
    {
      name: 'description',
      label: 'Описание',
      type: 'textarea',
      defaultValue: task.description ?? '',
    },
  ];
}

function TaskEditModal({ taskId, onClose, onSaved }) {
  const [task, setTask] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!taskId) return;
    setIsLoading(true);
    fetchWaTask(taskId)
      .then((data) => {
        setTask(data);
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [taskId]);

  async function handleSubmit(values) {
    setIsSaving(true);
    setFormError('');
    try {
      await updateWaTask(taskId, {
        subject: values.subject,
        priority: values.priority,
        status: values.status,
        description: values.description || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Не удалось сохранить задачу.');
      setIsSaving(false);
    }
  }

  if (isLoading || !task) {
    return (
      <div className="modal-backdrop" role="presentation">
        <div className="modal" role="dialog" aria-modal="true">
          <LoadingState title="Загружаем задачу..." />
        </div>
      </div>
    );
  }

  const message = task.message;

  return (
    <>
      <FormModal
        title="Редактировать задачу"
        isOpen
        isSaving={isSaving}
        fields={buildEditFields(task)}
        error={formError}
        onClose={onClose}
        onSubmit={handleSubmit}
        submitLabel="Сохранить"
      />
      {message ? (
        <div className="modal-backdrop" role="presentation" style={{ zIndex: 9 }}>
          {/* Дополнительная модалка с исходным сообщением показывается под основной FormModal */}
        </div>
      ) : null}
    </>
  );
}

function TaskDetailModal({ taskId, onClose, onSaved }) {
  const [task, setTask] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [editValues, setEditValues] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!taskId) return;
    setIsLoading(true);
    fetchWaTask(taskId)
      .then((data) => {
        setTask(data);
        setEditValues({
          subject: data.subject ?? '',
          priority: data.priority ?? 'normal',
          status: data.status ?? 'new',
          description: data.description ?? '',
        });
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [taskId]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleSave(e) {
    e.preventDefault();
    const errs = {};
    if (!editValues.subject.trim()) errs.subject = 'Заполните обязательное поле.';
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;

    setIsSaving(true);
    setFormError('');
    try {
      await updateWaTask(taskId, {
        subject: editValues.subject.trim(),
        priority: editValues.priority,
        status: editValues.status,
        description: editValues.description.trim() || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setFormError(err.message || 'Не удалось сохранить задачу.');
      setIsSaving(false);
    }
  }

  function set(field, value) {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <>
      <div className="modal-backdrop" role="presentation" onClick={onClose} />
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Задача WhatsApp"
        style={{ maxWidth: 640, zIndex: 10 }}
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !editValues ? (
          <LoadingState title="Загружаем задачу..." />
        ) : (
          <>
            <div className="modal__header">
              <h2>Задача WhatsApp</h2>
              <button aria-label="Закрыть" className="icon-button" onClick={onClose} type="button">×</button>
            </div>

            {formError ? <p className="form-error" role="alert">{formError}</p> : null}

            <form className="form-grid" noValidate onSubmit={handleSave}>
              <label className="field">
                <span>Тема <b aria-hidden="true">*</b></span>
                <input
                  type="text"
                  value={editValues.subject}
                  onChange={(e) => set('subject', e.target.value)}
                  aria-invalid={fieldErrors.subject ? 'true' : 'false'}
                />
                {fieldErrors.subject ? <span className="field__error">{fieldErrors.subject}</span> : null}
              </label>

              <label className="field">
                <span>Приоритет</span>
                <select value={editValues.priority} onChange={(e) => set('priority', e.target.value)}>
                  {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Статус</span>
                <select value={editValues.status} onChange={(e) => set('status', e.target.value)}>
                  {TASK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <label className="field">
                <span>Описание</span>
                <textarea rows={4} value={editValues.description} onChange={(e) => set('description', e.target.value)} />
              </label>

              <div className="modal__actions">
                <button className="button button--secondary" onClick={onClose} type="button">Отмена</button>
                <button className="button" disabled={isSaving} type="submit">
                  {isSaving ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </form>

            {/* Исходное сообщение и вложения */}
            {task?.message ? (
              <div style={{ padding: '16px 20px', borderTop: '1px solid #e5e7eb' }}>
                <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '0.85rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Исходное сообщение
                </p>
                <p style={{ margin: '0 0 4px', fontSize: '0.85rem', color: '#374151' }}>
                  <b>{task.message.sender_name || task.message.sender_phone}</b>
                  {' · '}
                  {formatDateTime(task.message.wa_timestamp)}
                </p>
                {task.message.body ? (
                  <div className="wa-drawer__body-text" style={{ marginTop: 8 }}>{task.message.body}</div>
                ) : null}
                {task.message.attachments?.length > 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <AttachmentList attachments={task.message.attachments} />
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </>
  );
}

export function WaTasksView() {
  const [activeStatus, setActiveStatus] = useState(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [tableState, setTableState] = useState({ error: '', isLoading: true, rows: [], total: 0 });
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, done: 0, closed: 0, all: 0 });
  const [editingTaskId, setEditingTaskId] = useState(null);
  const requestIdRef = useRef(0);

  async function loadTasks(status, currentLimit) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setTableState((s) => ({ ...s, error: '', isLoading: true }));

    try {
      const [data, summary] = await Promise.all([
        fetchWaTasks({ status: status ?? undefined, limit: currentLimit }),
        fetchWaTasksSummary(),
      ]);

      if (requestIdRef.current === requestId) {
        setTableState({ error: '', isLoading: false, rows: data.items ?? [], total: data.total ?? 0 });
        setCounts(summary?.counts ?? counts);
      }
    } catch (error) {
      if (requestIdRef.current === requestId) {
        setTableState((s) => ({ ...s, error: error.message, isLoading: false }));
      }
    }
  }

  useEffect(() => {
    loadTasks(activeStatus, limit);
  }, [activeStatus, limit]);

  function handleTabChange(value) {
    setActiveStatus(value);
    setLimit(PAGE_SIZE);
  }

  function handleShowMore() {
    setLimit((l) => l + PAGE_SIZE);
  }

  const hasMore = tableState.rows.length < tableState.total;

  return (
    <div>
      <div className="wa-filter-tabs" role="tablist" aria-label="Фильтр по статусу задач">
        {FILTER_TABS.map((tab) => {
          const count = tab.value ? (counts[tab.value] ?? 0) : (counts.all ?? 0);
          const isActive = activeStatus === tab.value;
          return (
            <button
              key={tab.value ?? 'all'}
              role="tab"
              aria-selected={isActive}
              className={`wa-tab ${isActive ? 'wa-tab--active' : ''}`}
              type="button"
              onClick={() => handleTabChange(tab.value)}
            >
              {tab.label}
              {count > 0 ? <span className="wa-tab-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {tableState.isLoading ? <LoadingState title="Загружаем задачи..." /> : null}

      {!tableState.isLoading && tableState.error ? (
        <ErrorState message={tableState.error} onRetry={() => loadTasks(activeStatus, limit)} />
      ) : null}

      {!tableState.isLoading && !tableState.error ? (
        <TaskTable rows={tableState.rows} onRowClick={(id) => setEditingTaskId(id)} />
      ) : null}

      {!tableState.isLoading && !tableState.error && hasMore ? (
        <div className="wa-show-more">
          <button className="button button--secondary" onClick={handleShowMore} type="button">
            Показать ещё ({tableState.total - tableState.rows.length})
          </button>
        </div>
      ) : null}

      {editingTaskId ? (
        <TaskDetailModal
          taskId={editingTaskId}
          onClose={() => setEditingTaskId(null)}
          onSaved={() => loadTasks(activeStatus, limit)}
        />
      ) : null}
    </div>
  );
}
