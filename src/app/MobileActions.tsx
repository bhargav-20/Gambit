import { useMatch } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { List, Lightbulb, BookOpen, Puzzle, ClipboardPaste, Microscope, Swords } from 'lucide-react';
import clsx from 'clsx';

/**
 * Mobile bottom action row — Moves / Idea / route-specific Tools button.
 *
 * The third slot is route-aware: it surfaces the same content the desktop
 * right column shows. The icon + label change to match (Openings, Puzzle,
 * Compose, Engine). On routes that don't have a right panel (Home, catalog
 * landings), only Moves + Idea show.
 *
 * In PvP it's Match / Moves (no Idea — no opening context in live games).
 */
export function MobileActions() {
  const setSheet = useUiStore((s) => s.setMobileSheet);
  const moveCount = useGameStore((s) => s.game.moves.length);
  const hasIdea = useGameStore((s) => Boolean(s.game.meta.openingId));
  const mode = useGameStore((s) => s.mode);
  const isOpeningDetail = useMatch('/openings/:id');
  const isPuzzleDetail = useMatch('/puzzles/:id');
  const isCompose = useMatch('/compose');
  const isAnalyze = useMatch('/analyze');

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

  // Pick the Tools button label/icon based on what the current route's
  // right panel actually is. Keeps the affordance discoverable and honest
  // (a "Catalog" button on /compose would be misleading).
  let toolsButton: { icon: React.ReactNode; label: string } | null = null;
  if (isOpeningDetail) toolsButton = { icon: <BookOpen size={16} />, label: 'Catalog' };
  else if (isPuzzleDetail) toolsButton = { icon: <Puzzle size={16} />, label: 'Puzzle' };
  else if (isCompose) toolsButton = { icon: <ClipboardPaste size={16} />, label: 'Import' };
  else if (isAnalyze) toolsButton = { icon: <Microscope size={16} />, label: 'Engine' };

  const cols = toolsButton ? 'grid-cols-3' : 'grid-cols-2';
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
      {toolsButton && (
        <Action
          icon={toolsButton.icon}
          label={toolsButton.label}
          onClick={() => setSheet('tools')}
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
