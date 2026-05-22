import { useMemo, useState, useEffect } from 'react';
import { Link, useLocation, useMatch } from 'react-router-dom';
import { MoveList } from './MoveList';
import { IdeaPanel } from '@/features/openings/IdeaPanel';
import { OpeningsPanel } from '@/features/openings/OpeningsPanel';
import { PuzzlePanel } from '@/features/puzzles/PuzzlePanel';
import { useGameStore } from '@/core/store/gameStore';
import { List, Lightbulb, LayoutGrid, ArrowUpRight } from 'lucide-react';
import clsx from 'clsx';

type Tab = 'browse' | 'moves' | 'idea';

/**
 * Tabbed area for the right column. Always shows Moves and Idea; adds a
 * Browse tab on catalog-style routes (Openings, Puzzles, Games) so the user
 * can switch between catalog items without leaving the board view.
 *
 * Browse is route-aware: the renderer below picks the correct catalog
 * panel from the URL. The active-item highlight inside each catalog is
 * driven by `game.meta.openingId` / `puzzleStore.active?.id` so picking a
 * row updates the URL and the highlight in lockstep.
 */
export function GamePanel() {
  const location = useLocation();
  const isOpenings = useMatch('/openings/*');
  const isPuzzles = useMatch('/puzzles/*');
  const hasBrowse = !!(isOpenings || isPuzzles);

  // Default tab depends on the route: if you just opened a catalog detail
  // page, Browse is the most useful starting tab. Otherwise Moves.
  const [tab, setTab] = useState<Tab>(hasBrowse ? 'browse' : 'moves');
  const hasIdea = useGameStore((s) => Boolean(s.game.meta.openingId));

  // When the route changes between catalog kinds, snap Browse back as the
  // initial tab. Switching between Sicilian → Italian shouldn't reset the
  // tab, but switching openings → puzzles should.
  useEffect(() => {
    if (hasBrowse) setTab('browse');
    else if (tab === 'browse') setTab('moves');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBrowse, isOpenings ? 'openings' : isPuzzles ? 'puzzles' : 'none']);

  const browseCatalogLink = useMemo(() => {
    if (isOpenings) return '/openings';
    if (isPuzzles) return '/puzzles';
    return null;
  }, [isOpenings, isPuzzles]);

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex items-center gap-1 p-1 panel-tight">
        {hasBrowse && (
          <TabButton
            icon={<LayoutGrid size={14} />}
            label="Browse"
            active={tab === 'browse'}
            onClick={() => setTab('browse')}
          />
        )}
        <TabButton
          icon={<List size={14} />}
          label="Moves"
          active={tab === 'moves'}
          onClick={() => setTab('moves')}
        />
        <TabButton
          icon={<Lightbulb size={14} />}
          label="Idea"
          active={tab === 'idea'}
          onClick={() => setTab('idea')}
          badge={hasIdea}
        />
      </div>
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'browse' && hasBrowse && (
          <>
            {browseCatalogLink && (
              <Link
                to={browseCatalogLink}
                className="text-xs text-ink-muted hover:text-accent flex items-center gap-1 self-start mb-2"
              >
                Open full catalog <ArrowUpRight size={11} />
              </Link>
            )}
            <div className="flex-1 min-h-0">
              {isOpenings && <OpeningsPanel />}
              {isPuzzles && <PuzzlePanel />}
            </div>
          </>
        )}
        {tab === 'moves' && <MoveList />}
        {tab === 'idea' && <IdeaPanel />}
        {/* Keep location read so eslint doesn't complain — and to force a
            re-render when the URL changes inside the catalog so the active
            row highlight updates. */}
        <span hidden>{location.pathname}</span>
      </div>
    </div>
  );
}

function TabButton({
  icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'relative flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-colors',
        active
          ? 'bg-accent text-bg'
          : 'text-ink-muted hover:text-ink hover:bg-bg-subtle',
      )}
    >
      {icon}
      {label}
      {badge && !active && (
        <span className="absolute top-1 right-2 h-1.5 w-1.5 rounded-full bg-accent" />
      )}
    </button>
  );
}
