export function LoadingState({ title = 'Загрузка данных...' }) {
  return (
    <div className="state state--loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{title}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state--error" role="alert">
      <div>
        <h2>Данные не загрузились</h2>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button className="button button--secondary" onClick={onRetry} type="button">Повторить</button>
      ) : null}
    </div>
  );
}

export function EmptyState({ description, title }) {
  return (
    <div className="state state--empty">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
