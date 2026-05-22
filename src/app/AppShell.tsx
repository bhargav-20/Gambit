import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { ThemeStyles } from '@/features/themes/ThemeStyles';
import { TopBar } from './TopBar';
import { Sidebar } from './NavSidebar';
import { SettingsSlideOver } from './SettingsSlideOver';
import { ExportModal } from './ExportModal';
import { useHashLoader } from './HashLoader';

/**
 * Persistent app frame. Renders the top bar and collapsible sidebar, and
 * routes the current page into the <Outlet />. Slide-overs (Settings,
 * Export) live here so they can sit over any route.
 *
 * The shell is also where we react to the `/settings` route — direct-linking
 * to that URL pops the slide-over over whichever route was previously active.
 * Closing the slide-over navigates back, so the URL and visible state stay in
 * sync without ever showing a blank "settings page."
 */
export function AppShell() {
  useHashLoader();
  const settingsOpen = useUiStore((s) => s.settingsOpen);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const exportOpen = useUiStore((s) => s.exportOpen);
  const setExportOpen = useUiStore((s) => s.setExportOpen);
  const location = useLocation();
  const navigate = useNavigate();

  // `/settings` is a deep-linkable shim — it just opens the slide-over over
  // whichever route the user was on, then redirects to Home so the URL stays
  // honest about the actual content under the overlay.
  useEffect(() => {
    if (location.pathname === '/settings') {
      setSettingsOpen(true);
      navigate('/', { replace: true });
    }
  }, [location.pathname, setSettingsOpen, navigate]);

  return (
    <div className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden">
      <ThemeStyles />
      <TopBar />
      <div className="flex-1 min-h-0 flex">
        <Sidebar />
        {/* Main is itself a flex container so route bodies that want to
            fill the viewport (ActivityLayout's board column) can use
            `flex-1 min-h-0` and resolve to the right height. Plain
            content routes (Home, catalog landings) just become the
            single flex child and scroll within main on desktop. */}
        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-y-auto lg:overflow-hidden">
          <Outlet />
        </main>
      </div>

      <SettingsSlideOver open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ExportModal open={exportOpen} onClose={() => setExportOpen(false)} />
    </div>
  );
}
