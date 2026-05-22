import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { usePuzzleStore } from '@/core/store/puzzleStore';
import { usePvpStore } from '@/core/store/pvpStore';
import { closeCurrent } from '@/features/pvp/session';
import { loadEmpty, STARTPOS } from '@/core/chess/pgn';
import { ThemeStyles } from '@/features/themes/ThemeStyles';
import { TopBar } from './TopBar';
import { Sidebar } from './NavSidebar';
import { SettingsSlideOver } from './SettingsSlideOver';
import { ShareModal } from './ShareModal';
import { ImportModal } from './ImportModal';
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
  const shareOpen = useUiStore((s) => s.shareOpen);
  const setShareOpen = useUiStore((s) => s.setShareOpen);
  const importOpen = useUiStore((s) => s.importOpen);
  const setImportOpen = useUiStore((s) => s.setImportOpen);
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

  // Centralized cleanup when the user leaves an exclusive activity (puzzle
  // or PvP). Each of these owns sticky state (active puzzle, open WebRTC
  // channel, clocks, names) that other routes shouldn't inherit. Doing it
  // here once means routes don't each need their own copy-pasted exit
  // effect, and entering /analyze from a puzzle (the case that prompted
  // this) leaves no puzzle baggage behind.
  useEffect(() => {
    const onPuzzleRoute = location.pathname.startsWith('/puzzles/');
    const onPlayRoute = location.pathname === '/play';

    if (!onPuzzleRoute && usePuzzleStore.getState().active) {
      usePuzzleStore.getState().exit();
      const m = useGameStore.getState().mode;
      if (m === 'puzzle') useGameStore.getState().endPuzzle();
      // The puzzle's loaded "game" is scratch context — the FEN seeded
      // for that tactic, not a real game worth carrying forward. Reset to
      // a fresh starting position so the next route (Analyze in
      // particular) doesn't inherit the puzzle position as its base.
      useGameStore
        .getState()
        .loadGame(loadEmpty(STARTPOS, { title: 'New game', source: 'editor' }));
    }
    if (!onPlayRoute) {
      const pvp = usePvpStore.getState();
      if (pvp.channelStatus !== 'idle' || pvp.localColor) {
        closeCurrent();
        pvp.reset();
        if (useGameStore.getState().mode === 'pvp') useGameStore.getState().endPvp();
      }
    }
  }, [location.pathname]);

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
      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
