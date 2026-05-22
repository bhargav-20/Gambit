import { useMatch } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { List, Lightbulb, LayoutGrid, Swords } from 'lucide-react';
import clsx from 'clsx';

/**
 * Mobile bottom action row — Moves / Idea / (route-aware fourth slot).
 *
 *   - In PvP: the fourth slot becomes a Match button that opens the resign/
 *     draw/move-list sheet. Idea hides (no opening context in live games).
 *   - On a catalog detail page (Openings or Puzzles): the fourth slot opens
 *     the catalog bottom-sheet so the user can switch items.
 *   - Elsewhere: only Moves + Idea show.
 *
 * Sidebar access has moved to the TopBar hamburger — that's why there's no
 * "Browse" button for the activity nav here anymore.
 */
export function MobileActions() {
  const setSheet = useUiStore((s) => s.setMobileSheet);
  const moveCount = useGameStore((s) => s.game.moves.length);
  const hasIdea = useGameStore((s) => Boolean(s.game.meta.openingId));
  const mode = useGameStore((s) => s.mode);
  const isOpeningDetail = useMatch('/openings/:id');
  const isPuzzleDetail = useMatch('/puzzles/:id');
  const showCatalog = !!(isOpeningDetail || isPuzzleDetail);

  if (mode === 'pvp') {
    return (
      <div className="lg:hidden grid grid-cols-2 gap-2">
        <Action
          icon={<Swords size={16} />}
          label="Match"
          sub={moveCount > 0 ? `${moveCount}` : undefined}
          onClick={() => setSheet('match')}
        />
        <Action
          icon={<List size={16} />}
          label="Moves"
          sub={moveCount > 0 ? `${moveCount}` : undefined}
          onClick={() => setSheet('moves')}
        />
      </div>
    );
  }

  const cols = showCatalog ? 'grid-cols-3' : 'grid-cols-2';
  return (
    <div className={clsx('lg:hidden grid gap-2', cols)}>
      <Action
        icon={<List size={16} />}
        label="Moves"
        sub={moveCount > 0 ? `${moveCount}` : undefined}
        onClick={() => setSheet('moves')}
      />
      <Action
        icon={<Lightbulb size={16} />}
        label="Idea"
        sub={hasIdea ? '•' : undefined}
        onClick={() => setSheet('idea')}
      />
      {showCatalog && (
        <Action
          icon={<LayoutGrid size={16} />}
          label="Catalog"
          onClick={() => setSheet('catalog')}
        />
      )}
    </div>
  );
}

function Action({
  icon,
  label,
  sub,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'panel py-2.5 flex flex-col items-center justify-center gap-0.5',
        'active:bg-bg-subtle transition-colors',
      )}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-accent">{icon}</span>
        <span className="text-sm font-medium text-ink">{label}</span>
        {sub && <span className="text-[10px] text-ink-faint">{sub}</span>}
      </span>
    </button>
  );
}
