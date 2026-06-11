import { useEffect, useState } from 'react';

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
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [currentPath]);

  useEffect(() => {
    if (!isMobileNavOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavOpen]);

  function handleNavigate(path) {
    setIsMobileNavOpen(false);
    navigate(path);
  }

  return (
    <div className="app-shell">
      <aside
        aria-label="Основная навигация"
        className={`sidebar ${isMobileNavOpen ? 'sidebar--open' : ''}`}
        id="mobile-nav"
      >
        <div className="sidebar__brand">
          <span aria-hidden="true" className="brand-mark">
            HD
          </span>
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
                handleNavigate(item.path);
              }}
            >
              <span>{item.title}</span>
            </a>
          ))}
        </nav>
      </aside>

      <button
        aria-controls="mobile-nav"
        aria-expanded={isMobileNavOpen}
        aria-label={isMobileNavOpen ? 'Закрыть меню' : 'Открыть меню'}
        className="mobile-menu-button"
        onClick={() => setIsMobileNavOpen((value) => !value)}
        type="button"
      >
        <span aria-hidden="true" className="mobile-menu-button__icon">
          <span />
          <span />
          <span />
        </span>
      </button>

      {isMobileNavOpen ? (
        <button
          aria-label="Закрыть навигацию"
          className="mobile-nav-backdrop"
          onClick={() => setIsMobileNavOpen(false)}
          type="button"
        />
      ) : null}

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
