import { Link, useLocation } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { Crown, Menu, Settings, Share2, Upload } from 'lucide-react';
import { NAV_ITEMS } from './navItems';

/**
 * Top bar — brand + breadcrumb (current activity) + action icons. The
 * activity sidebar is collapsed/expanded from the hamburger here; Settings
 * and Export are icon buttons that open slide-overs.
 *
 * Why no per-route header content?  Each route owns its own page-level
 * heading inside the main area. The TopBar stays minimal so the same shell
 * works for the dense activity views (board + catalog) and the Home page.
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
    <header className="shrink-0 h-14 border-b border-edge bg-bg-panel backdrop-blur-xl flex items-center px-2 sm:px-4 gap-2">
      <button
        className="btn-icon"
        onClick={toggleNav}
        title="Toggle navigation"
        aria-label="Toggle navigation"
      >
        <Menu size={16} />
      </button>

      <Link to="/" className="flex items-center gap-2 group">
        <div className="h-8 w-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
          <Crown size={16} className="text-accent" />
        </div>
        <div className="hidden sm:block">
          <div className="font-display text-base leading-none group-hover:text-accent transition-colors">Gambit</div>
          <div className="text-[9px] uppercase tracking-widest text-ink-faint">Chess Visualizer</div>
        </div>
      </Link>

      {/* Breadcrumb-ish current activity label */}
      {activity && (
        <div className="hidden sm:flex items-center gap-2 pl-3 ml-1 border-l border-edge text-sm">
          <span className="text-ink-muted">{activity.label}</span>
        </div>
      )}

      <div className="ml-auto flex items-center gap-1">
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
