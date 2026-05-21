import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { List, Lightbulb, LayoutGrid } from 'lucide-react';
import clsx from 'clsx';

/**
 * Three large tap targets visible only on mobile. They open bottom-sheet
 * drawers for the move list, the opening idea, and the sidebar panels.
 * On desktop these surfaces are visible inline, so this whole bar hides.
 */
export function MobileActions() {
  const setSheet = useUiStore((s) => s.setMobileSheet);
  const moveCount = useGameStore((s) => s.game.moves.length);
  const hasIdea = useGameStore((s) => Boolean(s.game.meta.openingId));

  return (
    <div className="lg:hidden grid grid-cols-3 gap-2">
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
      <Action
        icon={<LayoutGrid size={16} />}
        label="Browse"
        onClick={() => setSheet('browse')}
      />
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
