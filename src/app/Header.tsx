import { useGameStore } from '@/core/store/gameStore';
import type { GameMode } from '@/core/store/gameStore';
import { Crown, Eye, Pencil, Microscope, Puzzle, Swords } from 'lucide-react';
import clsx from 'clsx';

export function Header() {
  const title = useGameStore((s) => s.game.meta.title);
  const eco = useGameStore((s) => s.game.meta.eco);
  const description = useGameStore((s) => s.game.meta.description);
  const mode = useGameStore((s) => s.mode);

  return (
    <header className="flex items-center gap-2 sm:gap-4 px-1 sm:px-2">
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center">
          <Crown size={16} className="text-accent sm:hidden" />
          <Crown size={18} className="text-accent hidden sm:block" />
        </div>
        <div>
          <div className="font-display text-base sm:text-lg leading-none">Gambit</div>
          <div className="text-[9px] sm:text-[10px] uppercase tracking-widest text-ink-faint">Chess Visualizer</div>
        </div>
      </div>
      <div className="flex flex-col flex-1 min-w-0 pl-2 sm:pl-4 border-l border-edge">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="font-display text-sm sm:text-xl truncate">{title}</h1>
          {eco && <span className="chip-accent font-mono shrink-0 hidden sm:inline-flex">{eco}</span>}
          <ModeBadge mode={mode} />
        </div>
        {description && (
          <p className="text-[10px] sm:text-xs text-ink-muted truncate">{description}</p>
        )}
      </div>
    </header>
  );
}

/**
 * Small pill that makes the current interaction mode unmissable.
 *  - VIEWING  (subdued grey) — visualizer
 *  - COMPOSING (accent gold) — free-play with engine
 *  - ANALYZING (accent gold) — studying a game with branching
 *  - PUZZLE   (good green)   — solving a tactic
 */
function ModeBadge({ mode }: { mode: GameMode }) {
  const meta = BADGE_META[mode];
  return (
    <span
      className={clsx(
        'shrink-0 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        meta.cls,
      )}
      title={meta.tooltip}
    >
      {meta.icon}
      <span className="hidden xs:inline">{meta.label}</span>
    </span>
  );
}

const BADGE_META: Record<GameMode, { label: string; tooltip: string; cls: string; icon: React.ReactNode }> = {
  visualizer: {
    label: 'Viewing',
    tooltip: 'Visualizer — replay only',
    cls: 'border-edge bg-bg-subtle text-ink-muted',
    icon: <Eye size={10} />,
  },
  composer: {
    label: 'Composing',
    tooltip: 'Composer — play moves freely',
    cls: 'border-accent/50 bg-accent/10 text-accent',
    icon: <Pencil size={10} />,
  },
  analyze: {
    label: 'Analyzing',
    tooltip: 'Analyze — branch off and study the loaded game',
    cls: 'border-accent/50 bg-accent/10 text-accent',
    icon: <Microscope size={10} />,
  },
  puzzle: {
    label: 'Puzzle',
    tooltip: 'Puzzle — solve the tactic',
    cls: 'border-good/50 bg-good/10 text-good',
    icon: <Puzzle size={10} />,
  },
  pvp: {
    label: 'Live',
    tooltip: 'PvP — live game over LAN',
    cls: 'border-accent/50 bg-accent/10 text-accent',
    icon: <Swords size={10} />,
  },
};
