import { useEffect, useState } from 'react';

import { fetchHealth } from '../api/healthApi.js';

export function HomePage() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function loadHealth() {
      try {
        const result = await fetchHealth();

        if (isMounted) {
          setHealth(result);
          setError('');
        }
      } catch (loadError) {
        if (isMounted) {
          setHealth(null);
          setError(loadError.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadHealth();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="app-shell">
      <section className="status-panel" aria-labelledby="app-title">
        <div>
          <p className="eyebrow">Service Desk MVP</p>
          <h1 id="app-title">Helpdesk 1C</h1>
          <p className="summary">
            Каркас приложения готов: React клиент подключается к Express API через JSON endpoint.
          </p>
        </div>

        <div className="health-card">
          <div className="health-card__header">
            <span className={health ? 'status-dot status-dot--ok' : 'status-dot'} aria-hidden="true" />
            <h2>API health-check</h2>
          </div>

          {isLoading && <p className="muted">Проверяем соединение...</p>}

          {!isLoading && error && (
            <p className="error">API недоступен: {error}</p>
          )}

          {!isLoading && health && (
            <dl className="health-list">
              <div>
                <dt>Статус</dt>
                <dd>{health.status}</dd>
              </div>
              <div>
                <dt>Сервис</dt>
                <dd>{health.service}</dd>
              </div>
              <div>
                <dt>SQLite</dt>
                <dd>{health.sqliteDbPath}</dd>
              </div>
            </dl>
          )}
        </div>
      </section>
    </main>
  );
}
