import { EmptyState } from './States.jsx';

export function DataTable({ actions = [], columns, emptyTitle, emptyDescription, rows }) {
  if (!rows.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col">{column.label}</th>
            ))}
            {actions.length ? <th scope="col">Действия</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id ?? rowIndex}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render ? column.render(row) : row[column.key] ?? '-'}
                </td>
              ))}
              {actions.length ? (
                <td>
                  <div className="table-actions">
                    {actions.map((action) => (
                      <button
                        className={`link-button ${action.tone ? `link-button--${action.tone}` : ''}`}
                        key={action.label}
                        onClick={() => action.onClick(row)}
                        type="button"
                      >
                        {action.label}
                      </button>
                    ))}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
