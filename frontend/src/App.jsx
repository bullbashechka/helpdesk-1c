import { AppShell } from './components/AppShell.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import { ResourcePage } from './pages/ResourcePage.jsx';
import { TicketDetailPage } from './pages/TicketDetailPage.jsx';
import { dashboardPage, resourcePages } from './sections.js';
import { useAppRouter } from './useAppRouter.js';

export function App() {
  const router = useAppRouter();
  const ticketDetailMatch = router.path.match(/^\/tickets\/(\d+)$/);
  const currentPage =
    router.path === '/' || router.path === dashboardPage.path
      ? dashboardPage
      : resourcePages.find((page) => page.path === router.path);

  return (
    <AppShell currentPath={router.path} navigate={router.navigate}>
      {ticketDetailMatch ? (
        <TicketDetailPage navigate={router.navigate} ticketId={ticketDetailMatch[1]} />
      ) : currentPage ? (
        <ResourcePage navigate={router.navigate} page={currentPage} />
      ) : (
        <NotFoundPage />
      )}
    </AppShell>
  );
}
