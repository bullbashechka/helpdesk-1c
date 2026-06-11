import { navigationItems } from '../sections.js';

function getIsActive(currentPath, itemPath) {
  if (itemPath === '/dashboard') {
    return currentPath === '/' || currentPath === itemPath;
  }

  if (itemPath === '/tickets') {
    return currentPath === itemPath || currentPath.startsWith('/tickets/');
  }

  return currentPath === itemPath;
}

export function AppShell({ children, currentPath, navigate }) {
  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Основная навигация">
        <div className="sidebar__brand">
          <span className="brand-mark" aria-hidden="true">HD</span>
          <div>
            <p className="brand-title">Helpdesk 1C</p>
            <p className="brand-subtitle">Рабочее место</p>
          </div>
        </div>

        <nav className="nav-list">
          {navigationItems.map((item) => (
            <a
              aria-current={getIsActive(currentPath, item.path) ? 'page' : undefined}
              className="nav-link"
              href={item.path}
              key={item.path}
              onClick={(event) => {
                event.preventDefault();
                navigate(item.path);
              }}
            >
              <span>{item.title}</span>
            </a>
          ))}
        </nav>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div>
            <p className="topbar__eyebrow">Service Desk MVP</p>
            <h1>Операционный контур</h1>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}
