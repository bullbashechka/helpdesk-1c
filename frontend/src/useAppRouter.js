import { useEffect, useState } from 'react';

function normalizePath(pathname) {
  if (pathname === '/') {
    return '/dashboard';
  }

  return pathname.replace(/\/$/, '') || '/dashboard';
}

export function useAppRouter() {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname));

  useEffect(() => {
    function handlePopState() {
      setPath(normalizePath(window.location.pathname));
    }

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function navigate(nextPath) {
    const normalizedNextPath = normalizePath(nextPath);

    if (normalizedNextPath !== path) {
      window.history.pushState({}, '', normalizedNextPath);
      setPath(normalizedNextPath);
    }
  }

  return { navigate, path };
}
