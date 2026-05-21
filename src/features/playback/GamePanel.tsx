import { useState } from 'react';
import { MoveList } from './MoveList';
import { IdeaPanel } from '@/features/openings/IdeaPanel';
import { useGameStore } from '@/core/store/gameStore';
import { List, Lightbulb } from 'lucide-react';
import clsx from 'clsx';

type Tab = 'moves' | 'idea';

/**
 * Tabbed area for "Moves" (the SAN list with playback highlight) and "Idea"
 * (strategic overview of the loaded opening). The contextual per-move note
 * lives OUTSIDE this component (see MoveNote) so it stays visible in both
 * tabs and doesn't shift the playback controls when its height changes.
 */
export function GamePanel() {
  const [tab, setTab] = useState<Tab>('moves');
  const hasIdea = useGameStore((s) => Boolean(s.game.meta.openingId));

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <div className="flex items-center gap-1 p-1 panel-tight">
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
      <div className="flex-1 min-h-0">
        {tab === 'moves' ? <MoveList /> : <IdeaPanel />}
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
