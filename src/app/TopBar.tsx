import { Link, useLocation, useMatch } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { findOpening } from '@/features/openings/catalog';
import { findGame } from '@/features/games/catalog';
import { Crown, Menu, Settings, Share2, Upload } from 'lucide-react';
import { NAV_ITEMS } from './navItems';

/**
 * Top bar — brand + breadcrumb (current activity + loaded item) + action
 * icons. The activity sidebar is collapsed/expanded from the hamburger here;
 * Settings, Share, Import are icon buttons that open modals / slide-overs.
 *
 * Why surface the loaded item's title in the bar?  On mobile the right
 * column (which carries the catalog and item-specific UI) is tucked into a
 * bottom-sheet, so a user can wonder "wait, which opening am I on?" The
 * title in the top bar resolves that — visible at every viewport size.
 */
export function TopBar() {
  const toggleNav = useUiStore((s) => s.toggleNav);
  const setSettingsOpen = useUiStore((s) => s.setSettingsOpen);
  const setShareOpen = useUiStore((s) => s.setShareOpen);
  const setImportOpen = useUiStore((s) => s.setImportOpen);
  const hasGame = useGameStore((s) => s.game.moves.length > 0 || !!s.game.initialFen);
  const location = useLocation();
  const activity = NAV_ITEMS.find((n) => location.pathname.startsWith(n.path) && n.path !== '/') ?? null;

  return (
    <header className="shrink-0 h-14 border-b border-edge bg-bg-panel backdrop-blur-xl flex items-center px-2 gap-4 sticky top-0 z-30">
      <button
        className="btn-icon"
        onClick={toggleNav}
        title="Toggle navigation"
        aria-label="Toggle navigation"
      >
        <Menu size={16} />
      </button>

      <Link to="/" className="flex items-center gap-2 group shrink-0">
        <div className="h-8 w-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
          <Crown size={16} className="text-accent" />
        </div>
        <div className="hidden sm:block">
          <div className="font-display text-base leading-none group-hover:text-accent transition-colors">Gambit</div>
          <div className="text-[9px] uppercase tracking-widest text-ink-faint">Chess Visualizer</div>
        </div>
      </Link>

      <Breadcrumb activityLabel={activity?.label ?? null} />

      <div className="shrink-0 flex items-center gap-1">
        <button
          className="btn-icon"
          onClick={() => setImportOpen(true)}
          title="Import a game"
          aria-label="Import"
        >
          <Upload size={16} />
        </button>
        <button
          className="btn-icon"
          onClick={() => setShareOpen(true)}
          disabled={!hasGame}
          title="Share or export"
          aria-label="Share"
        >
          <Share2 size={16} />
        </button>
        <button
          className="btn-icon"
          onClick={() => setSettingsOpen(true)}
          title="Settings"
          aria-label="Settings"
        >
          <Settings size={16} />
        </button>
      </div>
    </header>
  );
}

/**
 * Activity > Title breadcrumb. The title is **route-derived** (looked up
 * from the URL params, not pulled from gameStore.meta) so it disappears
 * the moment the user navigates away from the detail view — even if the
 * loaded game's metadata still says "Sicilian Defense — Dragon" because
 * the user clicked Compose / Analyze / Home next.
 *
 * On sm+ both activity and title show side-by-side; on mobile only the
 * title shows so the limited horizontal space goes to "what am I looking
 * at right now."
 */
function Breadcrumb({ activityLabel }: { activityLabel: string | null }) {
  const openingMatch = useMatch('/openings/:openingId');
  const gameMatch = useMatch('/games/:gameId');

  let title: string | null = null;
  if (openingMatch?.params.openingId) {
    const o = findOpening(openingMatch.params.openingId);
    title = o?.name ?? null;
  } else if (gameMatch?.params.gameId) {
    const g = findGame(gameMatch.params.gameId);
    title = g?.title ?? null;
  }

  if (!activityLabel && !title) return <div className="flex-1 min-w-0" />;

  return (
    <div className="flex-1 min-w-0 flex items-center gap-2 pl-2 sm:pl-3 sm:ml-1 sm:border-l sm:border-edge text-sm">
      {activityLabel && (
        <span className="hidden sm:inline text-ink-muted shrink-0">{activityLabel}</span>
      )}
      {activityLabel && title && (
        <span className="hidden sm:inline text-ink-faint shrink-0">/</span>
      )}
      {title && (
        <span className="text-ink truncate font-medium">{title}</span>
      )}
    </div>
  );
}
