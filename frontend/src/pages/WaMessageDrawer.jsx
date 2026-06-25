import { useEffect, useState } from 'react';

import { archiveWaMessage, createWaTask, fetchWaMessage, unarchiveWaMessage } from '../api/whatsappApi.js';
import { AttachmentList } from '../components/AttachmentList.jsx';
import { formatDateTime } from '../utils/formatters.js';

const PRIORITY_OPTIONS = [
  { label: 'Низкий', value: 'low' },
  { label: 'Обычный', value: 'normal' },
  { label: 'Высокий', value: 'high' },
  { label: 'Срочный', value: 'urgent' },
];

const STATUS_LABELS = {
  new: 'Новое',
  in_progress: 'В работе',
  task_created: 'Задача',
  archived: 'Архив',
};

function TaskForm({ message, onCreated, onCancel }) {
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState('normal');
  const [description, setDescription] = useState(message?.body ?? '');
  const [subjectError, setSubjectError] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!subject.trim()) {
      setSubjectError('Заполните обязательное поле.');
      return;
    }
    setSubjectError('');
    setFormError('');
    setIsSaving(true);
    try {
      const task = await createWaTask({
        message_id: message.id,
        subject: subject.trim(),
        priority,
        description: description.trim() || null,
      });
      onCreated(task);
    } catch (err) {
      setFormError(err.message || 'Не удалось создать задачу.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="wa-task-form" onSubmit={handleSubmit} noValidate>
      <p className="wa-task-form__title">Новая задача</p>

      {formError ? <p className="form-error" role="alert">{formError}</p> : null}

      <label className="field">
        <span>Тема <b aria-hidden="true">*</b></span>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          aria-invalid={subjectError ? 'true' : 'false'}
          autoFocus
        />
        {subjectError ? <span className="field__error">{subjectError}</span> : null}
      </label>

      <label className="field">
        <span>Приоритет</span>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </label>

      <label className="field">
        <span>Описание</span>
        <textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      {message?.client_id ? (
        <div className="field">
          <span className="field__label">Клиент</span>
          <p style={{ margin: 0, fontWeight: 600 }}>{message.clientName ?? '—'}</p>
        </div>
      ) : null}

      <div className="wa-task-form__actions">
        <button type="submit" className="button" disabled={isSaving}>
          {isSaving ? 'Сохранение...' : 'Создать задачу'}
        </button>
        <button type="button" className="button button--secondary" onClick={onCancel}>
          Отмена
        </button>
      </div>
    </form>
  );
}

export function WaMessageDrawer({ messageId, onClose, onAction, onOpenTask }) {
  const [message, setMessage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    if (!messageId) return;
    setIsLoading(true);
    setActionError('');
    setShowTaskForm(false);
    fetchWaMessage(messageId)
      .then((data) => {
        setMessage(data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, [messageId]);

  // Close on Escape
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function handleArchive() {
    setIsActing(true);
    setActionError('');
    try {
      await archiveWaMessage(messageId);
      onAction();
      onClose();
    } catch (err) {
      setActionError(err.message || 'Не удалось отправить в архив.');
      setIsActing(false);
    }
  }

  async function handleUnarchive() {
    setIsActing(true);
    setActionError('');
    try {
      await unarchiveWaMessage(messageId);
      onAction();
      onClose();
    } catch (err) {
      setActionError(err.message || 'Не удалось вернуть в инбокс.');
      setIsActing(false);
    }
  }

  function handleTaskCreated() {
    onAction();
    onClose();
  }

  const senderDisplay = message?.sender_name || message?.sender_phone || '—';
  const status = message?.processing_status;

  return (
    <>
      <div className="wa-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="wa-drawer" role="dialog" aria-modal="true" aria-label="Сообщение WhatsApp">
        <div className="wa-drawer__header">
          <h2 className="wa-drawer__title">
            {isLoading ? 'Загрузка...' : senderDisplay}
          </h2>
          <button className="wa-drawer__close" onClick={onClose} aria-label="Закрыть" type="button">×</button>
        </div>

        <div className="wa-drawer__body">
          {isLoading ? (
            <p style={{ color: '#9ca3af' }}>Загрузка сообщения...</p>
          ) : !message ? (
            <p style={{ color: '#dc2626' }}>Не удалось загрузить сообщение.</p>
          ) : (
            <>
              <div className="wa-drawer__meta">
                <span className="wa-drawer__sender">{senderDisplay}</span>
                {message.client_name ? (
                  <span className="wa-drawer__client">{message.client_name}</span>
                ) : (
                  <span className="wa-unrecognized-chip">клиент не распознан</span>
                )}
                <span className="wa-drawer__date">{formatDateTime(message.wa_timestamp)}</span>
                <span>
                  <span className={`status-badge status-badge--wa-${status}`}>
                    {STATUS_LABELS[status] ?? status}
                  </span>
                </span>
              </div>

              <hr className="wa-drawer__divider" />

              {message.body ? (
                <div className="wa-drawer__body-text">{message.body}</div>
              ) : (
                <p className="wa-drawer__empty-body">Текст сообщения отсутствует.</p>
              )}

              {message.attachments?.length > 0 ? (
                <AttachmentList attachments={message.attachments} />
              ) : null}

              <hr className="wa-drawer__divider" />

              {actionError ? <p className="form-error" role="alert">{actionError}</p> : null}

              {status === 'new' && !showTaskForm ? (
                <div className="wa-drawer__actions">
                  <button
                    type="button"
                    className="button"
                    onClick={() => setShowTaskForm(true)}
                    disabled={isActing}
                  >
                    Создать задачу
                  </button>
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={handleArchive}
                    disabled={isActing}
                  >
                    В архив
                  </button>
                </div>
              ) : null}

              {status === 'new' && showTaskForm ? (
                <TaskForm
                  message={message}
                  onCreated={handleTaskCreated}
                  onCancel={() => setShowTaskForm(false)}
                />
              ) : null}

              {status === 'archived' ? (
                <div className="wa-drawer__actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={handleUnarchive}
                    disabled={isActing}
                  >
                    Вернуть в инбокс
                  </button>
                </div>
              ) : null}

              {status === 'task_created' ? (
                <div className="wa-drawer__actions">
                  <button
                    type="button"
                    className="button button--secondary"
                    onClick={onOpenTask}
                  >
                    Перейти к задаче
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
