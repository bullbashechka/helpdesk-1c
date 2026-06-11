import { useEffect, useState } from 'react';

import { navigationItems } from '../sections.js';

function NavIcon({ name }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  if (name === 'dashboard') {
    return (
      <svg {...props}>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  if (name === 'tickets') {
    return (
      <svg {...props}>
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
      </svg>
    );
  }

  if (name === 'clients') {
    return (
      <svg {...props}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }

  if (name === 'contracts') {
    return (
      <svg {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }

  if (name === 'employees') {
    return (
      <svg {...props}>
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    );
  }

  if (name === 'reports') {
    return (
      <svg {...props}>
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    );
  }

  return null;
}

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
              <NavIcon name={item.icon} />
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
