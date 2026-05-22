import { Link } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import { usePuzzleStore } from '@/core/store/puzzleStore';
import { NAV_ITEMS } from '@/app/navItems';
import { ChevronRight } from 'lucide-react';
import clsx from 'clsx';

/**
 * Landing page. Activity cards in a grid + a "Pick up where you left off"
 * section that reads from the persisted gameStore / puzzleStore to suggest
 * a one-click return to whatever the user was doing last session.
 *
 * Deliberately no board on this page — Home is for navigation, not for
 * studying. The board state stays in memory; the moment a user clicks into
 * Openings/Puzzles/etc., the board reappears.
 */
export function Home() {
  // Skip the Home entry — it's where we are.
  const cards = NAV_ITEMS.filter((n) => n.path !== '/');

  const game = useGameStore((s) => s.game);
  const ply = useGameStore((s) => s.ply);
  const activePuzzleId = usePuzzleStore((s) => s.active?.id ?? null);
  const puzzleStatus = usePuzzleStore((s) => s.status);

  const hasGameContext =
    game.meta.openingId || (game.meta.source !== 'editor' && game.moves.length > 0);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-10 overflow-y-auto">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl sm:text-4xl leading-tight">
          What do you feel like playing?
        </h1>
        <p className="text-ink-muted text-sm sm:text-base">
          A chess sandbox — openings, puzzles, live games with a friend on the same WiFi, and a composer for everything in between.
        </p>
      </header>

      {/* Resume card — only render when we actually have something worth resuming. */}
      {(hasGameContext || activePuzzleId) && (
        <section className="flex flex-col gap-2">
          <div className="label">Pick up where you left off</div>
          <div className="grid sm:grid-cols-2 gap-3">
            {hasGameContext && (
              <Link
                to={game.meta.openingId ? `/openings/${game.meta.openingId}` : '/analyze'}
                className="panel-tight p-4 hover:border-edge-strong transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-ink-faint">Last game</div>
                  <div className="font-display text-base truncate mt-0.5">{game.meta.title}</div>
                  {game.meta.eco && (
                    <div className="text-xs text-ink-muted">
                      {game.meta.eco} · move {Math.max(1, Math.ceil(ply / 2))} of {Math.max(1, Math.ceil(game.moves.length / 2))}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} className="text-ink-muted" />
              </Link>
            )}
            {activePuzzleId && (
              <Link
                to={`/puzzles/${activePuzzleId}`}
                className="panel-tight p-4 hover:border-edge-strong transition-colors flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs uppercase tracking-wider text-ink-faint">Puzzle</div>
                  <div className="font-display text-base truncate mt-0.5">{activePuzzleId.replace(/-/g, ' ')}</div>
                  <div className="text-xs text-ink-muted">{puzzleStatus === 'solved' ? 'Solved — try the next' : 'Resume'}</div>
                </div>
                <ChevronRight size={16} className="text-ink-muted" />
              </Link>
            )}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <div className="label">Activities</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {cards.map((c) => (
            <Link
              key={c.path}
              to={c.path}
              className={clsx(
                'panel-tight p-4 sm:p-5 flex flex-col gap-2 transition-colors group',
                c.comingSoon
                  ? 'opacity-60 pointer-events-none'
                  : 'hover:border-accent/40 hover:bg-accent/[0.03]',
              )}
            >
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
                  {c.icon}
                </div>
                <div className="flex-1">
                  <div className="font-display text-base flex items-center gap-1.5">
                    {c.label}
                    {c.comingSoon && (
                      <span className="chip text-[9px] uppercase tracking-wider px-1.5 py-0">soon</span>
                    )}
                  </div>
                </div>
              </div>
              {c.blurb && (
                <p className="text-xs text-ink-muted leading-relaxed">{c.blurb}</p>
              )}
            </Link>
          ))}
        </div>
      </section>

      <footer className="mt-auto pt-6 border-t border-edge text-[11px] text-ink-faint">
        Gambit · Client-side · Shortcuts: ←/→ step · space play/pause · F flip
      </footer>
    </div>
  );
}
