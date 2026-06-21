import { useEffect, useRef, useState } from 'react';

import { fetchConnectorStatus, fetchWaMessages, fetchWaSummary } from '../api/whatsappApi.js';
import { EmptyState, ErrorState, LoadingState } from '../components/States.jsx';
import { formatDateTime } from '../utils/formatters.js';
import { WaMessageDrawer } from './WaMessageDrawer.jsx';
import { WaTasksView } from './WaTasksView.jsx';

const STATUS_LABELS = {
  new: 'Новое',
  in_progress: 'В работе',
  task_created: 'Задача',
  archived: 'Архив',
};

const ATTACHMENT_PLACEHOLDERS = {
  photo: '[Фото]',
  video: '[Видео]',
  document: '[Документ]',
  voice: '[Голосовое]',
};

const PAGE_SIZE = 50;

function bodyPreview(body, attachmentKinds) {
  if (body && body.trim()) {
    return body.length > 80 ? `${body.slice(0, 80)}…` : body;
  }
  if (attachmentKinds && attachmentKinds.length > 0) {
    return attachmentKinds.map((k) => ATTACHMENT_PLACEHOLDERS[k] ?? `[${k}]`).join(' ');
  }
  return '—';
}

function ConnectorBanner({ status }) {
  if (!status) return null;

  const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
  const heartbeatOk =
    status.last_heartbeat_at && new Date(status.last_heartbeat_at).getTime() > twoMinutesAgo;

  if (status.state === 'ready' && heartbeatOk) return null;

  const isQr = status.state === 'qr_required';
  const msg = isQr
    ? 'Коннектор ожидает сканирования QR-кода — новые сообщения не поступают.'
    : 'Связь с WhatsApp потеряна — новые сообщения не поступают.';

  return (
    <div className="connector-banner connector-banner--warn" role="alert">
      <span className="connector-banner__icon" aria-hidden="true">⚠</span>
      <span>{msg}</span>
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`status-badge status-badge--wa-${status}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function SenderCell({ senderName, senderPhone, chatType, groupName }) {
  const display = senderName || senderPhone;
  return (
    <div>
      <span>{display}</span>
      {chatType === 'group' && groupName ? (
        <span className="wa-group-chip" title={groupName}>{groupName}</span>
      ) : null}
    </div>
  );
}

function ClientCell({ clientName }) {
  if (clientName) return <span>{clientName}</span>;
  return <span className="wa-unrecognized-chip">не распознан</span>;
}

function AttachmentsCell({ count }) {
  if (!count) return null;
  return (
    <span className="wa-attachment-cell" title={`${count} вложений`}>
      📎 {count}
    </span>
  );
}

function InboxTable({ rows, onRowClick }) {
  if (!rows.length) {
    return (
      <EmptyState
        title="Сообщений нет"
        description="Входящие сообщения WhatsApp появятся здесь."
      />
    );
  }

  return (
    <div className="table-wrap">
      <table className="data-table wa-inbox-table">
        <thead>
          <tr>
            <th scope="col">Отправитель</th>
            <th scope="col">Клиент</th>
            <th scope="col">Сообщение</th>
            <th scope="col">Дата/время</th>
            <th scope="col">Вложения</th>
            <th scope="col">Статус</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((msg) => (
            <tr
              key={msg.id}
              className="clickable-row"
              onClick={() => onRowClick(msg.id)}
            >
              <td>
                <SenderCell
                  chatType={msg.chatType}
                  groupName={msg.groupName}
                  senderName={msg.senderName}
                  senderPhone={msg.senderPhone}
                />
              </td>
              <td>
                <ClientCell clientName={msg.clientName} />
              </td>
              <td className="wa-body-cell">
                {bodyPreview(msg.body, msg.attachmentKinds)}
              </td>
              <td className="wa-date-cell">{formatDateTime(msg.waTimestamp)}</td>
              <td>
                <AttachmentsCell count={msg.attachmentsCount} />
              </td>
              <td>
                <StatusBadge status={msg.processingStatus} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Фильтр-вкладки инбокса: «В работе» убрана из UI (статус живёт в БД)
const FILTER_TABS = [
  { label: 'Все', value: null },
  { label: 'Новое', value: 'new' },
  { label: 'Задача', value: 'task_created' },
  { label: 'Архив', value: 'archived' },
];

function InboxView({ onOpenTask }) {
  const [activeStatus, setActiveStatus] = useState(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [tableState, setTableState] = useState({ error: '', isLoading: true, rows: [], total: 0 });
  const [counts, setCounts] = useState({ new: 0, in_progress: 0, task_created: 0, archived: 0, all: 0 });
  const [connectorStatus, setConnectorStatus] = useState(null);
  const [openMessageId, setOpenMessageId] = useState(null);
  const requestIdRef = useRef(0);
  const pollingRef = useRef(null);

  async function loadMessages(status, currentLimit) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setTableState((s) => ({ ...s, error: '', isLoading: true }));

    try {
      const [data, summary] = await Promise.all([
        fetchWaMessages({ status: status ?? undefined, limit: currentLimit }),
        fetchWaSummary(),
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

  async function loadConnectorStatus() {
    try {
      const data = await fetchConnectorStatus();
      setConnectorStatus(data);
    } catch {
      setConnectorStatus(null);
    }
  }

  useEffect(() => {
    loadConnectorStatus();
  }, []);

  useEffect(() => {
    loadMessages(activeStatus, limit);

    function tick() {
      if (document.visibilityState === 'hidden') return;
      loadMessages(activeStatus, limit);
      loadConnectorStatus();
    }

    pollingRef.current = setInterval(tick, 15000);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(pollingRef.current);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [activeStatus, limit]);

  function handleTabChange(value) {
    setActiveStatus(value);
    setLimit(PAGE_SIZE);
  }

  function handleShowMore() {
    setLimit((l) => l + PAGE_SIZE);
  }

  function handleDrawerAction() {
    loadMessages(activeStatus, limit);
  }

  const hasMore = tableState.rows.length < tableState.total;

  return (
    <>
      <ConnectorBanner status={connectorStatus} />

      <div className="wa-filter-tabs" role="tablist" aria-label="Фильтр по статусу">
        {FILTER_TABS.map((tab) => {
          const count = tab.value ? (counts[tab.value] ?? 0) : (counts.all ?? 0);
          const isActive = activeStatus === tab.value;
          return (
            <button
              aria-selected={isActive}
              className={`wa-tab ${isActive ? 'wa-tab--active' : ''}`}
              key={tab.value ?? 'all'}
              onClick={() => handleTabChange(tab.value)}
              role="tab"
              type="button"
            >
              {tab.label}
              {count > 0 ? <span className="wa-tab-count">{count}</span> : null}
            </button>
          );
        })}
      </div>

      {tableState.isLoading ? <LoadingState title="Загружаем сообщения..." /> : null}

      {!tableState.isLoading && tableState.error ? (
        <ErrorState
          message={tableState.error}
          onRetry={() => loadMessages(activeStatus, limit)}
        />
      ) : null}

      {!tableState.isLoading && !tableState.error ? (
        <InboxTable rows={tableState.rows} onRowClick={(id) => setOpenMessageId(id)} />
      ) : null}

      {!tableState.isLoading && !tableState.error && hasMore ? (
        <div className="wa-show-more">
          <button className="button button--secondary" onClick={handleShowMore} type="button">
            Показать ещё ({tableState.total - tableState.rows.length})
          </button>
        </div>
      ) : null}

      {openMessageId ? (
        <WaMessageDrawer
          messageId={openMessageId}
          onClose={() => setOpenMessageId(null)}
          onAction={handleDrawerAction}
          onOpenTask={() => {
            setOpenMessageId(null);
            onOpenTask();
          }}
        />
      ) : null}
    </>
  );
}

export function WaInboxPage({ page }) {
  const [view, setView] = useState('inbox');

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <p className="section-label">{page.kicker}</p>
          <h2>{page.title}</h2>
          <p>{page.description}</p>
        </div>
      </div>

      <div className="wa-section-tabs" role="tablist" aria-label="Раздел WhatsApp">
        <button
          role="tab"
          aria-selected={view === 'inbox'}
          className={`wa-section-tab ${view === 'inbox' ? 'wa-section-tab--active' : ''}`}
          type="button"
          onClick={() => setView('inbox')}
        >
          Инбокс
        </button>
        <button
          role="tab"
          aria-selected={view === 'tasks'}
          className={`wa-section-tab ${view === 'tasks' ? 'wa-section-tab--active' : ''}`}
          type="button"
          onClick={() => setView('tasks')}
        >
          Задачи
        </button>
      </div>

      {view === 'inbox' ? (
        <InboxView onOpenTask={() => setView('tasks')} />
      ) : (
        <WaTasksView />
      )}
    </section>
  );
}
