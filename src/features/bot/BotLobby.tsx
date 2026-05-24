import { Bot, Play } from 'lucide-react';
import clsx from 'clsx';
import { useGameStore } from '@/core/store/gameStore';
import { useBotStore } from '@/core/store/botStore';
import type { BotColor } from '@/core/store/botStore';
import { BOT_DIFFICULTIES, type BotDifficultyId } from './difficulty';

/**
 * Lobby for starting a game against Stockfish. Picks difficulty + color
 * and hands off to the in-game panel. No clocks for v1 — keeping it
 * simple; clocks are a roadmap item.
 */
export function BotLobby() {
  const difficulty = useBotStore((s) => s.difficulty);
  const setDifficulty = useBotStore((s) => s.setDifficulty);
  const preferredColor = useBotStore((s) => s.preferredColor);
  const setPreferredColor = useBotStore((s) => s.setPreferredColor);
  const startMatch = useBotStore((s) => s.startMatch);
  const startBot = useGameStore((s) => s.startBot);

  const begin = () => {
    const resolved: BotColor =
      preferredColor === 'random'
        ? Math.random() < 0.5
          ? 'white'
          : 'black'
        : preferredColor;
    // Seed gameStore first so the board is in 'play-bot' mode by the time
    // useBot's effect re-runs from the resulting state change.
    startBot();
    startMatch(resolved);
    // Match the board's orientation to the player's color so they're not
    // staring at their opponent's pieces from move 1.
    if (useGameStore.getState().orientation !== resolved) {
      useGameStore.getState().flip();
    }
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Bot size={16} className="text-accent" />
        <h2 className="font-display text-lg">Play a bot</h2>
      </div>

      <p className="text-sm text-ink-muted">
        Stockfish 18 Lite, locally — no server, no telemetry. Picks a move at
        the strength you set.
      </p>

      <div>
        <label className="label">Difficulty</label>
        <div className="grid grid-cols-2 gap-2 mt-1.5">
          {BOT_DIFFICULTIES.map((d) => (
            <DifficultyCard
              key={d.id}
              id={d.id}
              label={d.label}
              blurb={d.blurb}
              approxElo={d.approxElo}
              active={difficulty === d.id}
              onClick={() => setDifficulty(d.id)}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="label">Play as</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          <ColorChip label="White" active={preferredColor === 'white'} onClick={() => setPreferredColor('white')} />
          <ColorChip label="Random" active={preferredColor === 'random'} onClick={() => setPreferredColor('random')} />
          <ColorChip label="Black" active={preferredColor === 'black'} onClick={() => setPreferredColor('black')} />
        </div>
      </div>

      <button className="btn-primary mt-2" onClick={begin}>
        <Play size={14} /> Start game
      </button>
    </div>
  );
}

function DifficultyCard({
  label,
  blurb,
  approxElo,
  active,
  onClick,
}: {
  id: BotDifficultyId;
  label: string;
  blurb: string;
  approxElo: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-3 text-left transition-colors',
        active
          ? 'border-accent/60 bg-accent/10'
          : 'border-edge bg-bg-raised hover:border-edge-strong',
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className={clsx('text-sm font-medium', active ? 'text-accent' : 'text-ink')}>
          {label}
        </span>
        <span className="font-mono text-[10px] text-ink-faint">{approxElo}</span>
      </div>
      <p className="text-[11px] text-ink-faint leading-tight mt-1">{blurb}</p>
    </button>
  );
}

function ColorChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-lg border px-2 py-1.5 text-xs transition-colors',
        active
          ? 'border-accent/60 bg-accent/10 text-accent'
          : 'border-edge bg-bg-raised hover:border-edge-strong text-ink',
      )}
    >
      {label}
    </button>
  );
}
