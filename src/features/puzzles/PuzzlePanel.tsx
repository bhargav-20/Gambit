import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PUZZLES } from './catalog';
import type { Puzzle } from './catalog';
import { usePuzzleStore } from '@/core/store/puzzleStore';
import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { loadEmpty } from '@/core/chess/pgn';
import { Puzzle as PuzzleIcon, Trophy, X, Check, RotateCcw, Lightbulb, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

/**
 * The puzzle browser + active-puzzle view. When a puzzle is started, the
 * board loads its FEN and the puzzle store gates the user's moves through
 * `checkMove` (wired in Board2D's after-handler).
 */
export function PuzzlePanel() {
  const active = usePuzzleStore((s) => s.active);
  if (active) return <ActivePuzzle />;
  return <PuzzleList />;
}

function PuzzleList() {
  const solvedIds = usePuzzleStore((s) => s.solvedIds);
  const solvedCount = usePuzzleStore((s) => s.solvedCount);
  const attemptedCount = usePuzzleStore((s) => s.attemptedCount);
  const streak = usePuzzleStore((s) => s.streak);
  const navigate = useNavigate();
  const setMobileSheet = useUiStore((s) => s.setMobileSheet);

  const [filter, setFilter] = useState<'all' | 1 | 2 | 3>('all');
  const filtered = PUZZLES.filter((p) => filter === 'all' || p.difficulty === filter);

  const launch = (puzzle: Puzzle) => {
    // PuzzleDetailRoute handles the actual store wiring on mount. We just
    // change the URL — that keeps Back/Forward sensible and lets users link
    // directly to a specific puzzle.
    navigate(`/puzzles/${puzzle.id}`);
    setMobileSheet(null);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <PuzzleIcon size={16} className="text-accent" />
        <h2 className="font-display text-lg">Puzzles</h2>
        <span className="chip ml-auto">{PUZZLES.length}</span>
      </div>

      <div className="panel-tight p-3 grid grid-cols-3 gap-2 text-center">
        <Stat label="Solved" value={solvedCount} icon={<Trophy size={11} />} />
        <Stat label="Attempted" value={attemptedCount} />
        <Stat label="Streak" value={streak} highlight={streak >= 3} />
      </div>

      <div className="flex gap-1.5">
        <DifficultyChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
        <DifficultyChip label="Easy" active={filter === 1} onClick={() => setFilter(1)} />
        <DifficultyChip label="Medium" active={filter === 2} onClick={() => setFilter(2)} />
        <DifficultyChip label="Hard" active={filter === 3} onClick={() => setFilter(3)} />
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1 flex flex-col gap-1.5">
        {filtered.map((p) => {
          const solved = solvedIds.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => launch(p)}
              className={clsx(
                'text-left rounded-lg border px-3 py-2.5 transition-colors',
                solved
                  ? 'border-good/40 bg-good/5'
                  : 'border-edge bg-bg-raised hover:border-edge-strong hover:bg-bg-subtle',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink flex items-center gap-1.5">
                  {solved && <Check size={12} className="text-good" />}
                  {p.title}
                </span>
                <DifficultyBadge level={p.difficulty} />
              </div>
              <p className="text-xs text-ink-muted mt-0.5">{p.theme}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ActivePuzzle() {
  const active = usePuzzleStore((s) => s.active);
  const status = usePuzzleStore((s) => s.status);
  const start = usePuzzleStore((s) => s.start);
  const loadGame = useGameStore((s) => s.loadGame);
  const startPuzzleMode = useGameStore((s) => s.startPuzzle);
  const navigate = useNavigate();
  const [showHint, setShowHint] = useState(false);

  if (!active) return null;

  const reset = () => {
    const game = loadEmpty(active.fen, { title: active.title, source: 'editor' });
    loadGame(game);
    startPuzzleMode();
    start(active);
    setShowHint(false);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <button
        className="btn-ghost text-xs self-start gap-1 -ml-2"
        onClick={() => navigate('/puzzles')}
      >
        <ChevronRight size={12} className="rotate-180" /> Back to puzzles
      </button>

      <div>
        <h2 className="font-display text-base leading-tight">{active.title}</h2>
        <div className="flex items-center gap-2 mt-0.5">
          <DifficultyBadge level={active.difficulty} />
          <span className="text-[10px] text-ink-muted uppercase tracking-wider">{active.theme}</span>
        </div>
      </div>

      <div
        className={clsx(
          'panel-tight p-3 text-sm',
          status === 'solved' && 'border-good/50 bg-good/5',
          status === 'wrong' && 'border-bad/50 bg-bad/5',
        )}
      >
        {status === 'in_progress' && (
          <div className="flex items-start gap-2">
            <Lightbulb size={14} className="text-accent shrink-0 mt-0.5" />
            <p className="text-ink">Find the best move{active.solution.length > 1 ? ' — and continue the line' : ''}.</p>
          </div>
        )}
        {status === 'wrong' && (
          <div className="flex items-start gap-2">
            <X size={14} className="text-bad shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-bad">Not quite</p>
              <p className="text-xs text-ink-muted mt-0.5">Try a different move, or use the hint below.</p>
            </div>
          </div>
        )}
        {status === 'solved' && (
          <div className="flex items-start gap-2">
            <Trophy size={14} className="text-good shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-good">Solved!</p>
              <p className="text-xs text-ink-muted mt-0.5 font-mono">
                {active.solution.join(' ')}
              </p>
            </div>
          </div>
        )}
      </div>

      {active.hint && (
        <button
          className="btn text-xs"
          onClick={() => setShowHint(true)}
          disabled={showHint || status === 'solved'}
        >
          <Lightbulb size={12} />
          {showHint ? active.hint : 'Show hint'}
        </button>
      )}

      {status !== 'in_progress' && (
        <button className="btn-primary" onClick={reset}>
          <RotateCcw size={14} /> Try again
        </button>
      )}
    </div>
  );
}

function Stat({ label, value, icon, highlight }: { label: string; value: number; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <div>
      <div className={clsx('font-display text-xl flex items-center justify-center gap-1', highlight && 'text-accent')}>
        {icon}
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-ink-faint mt-0.5">{label}</div>
    </div>
  );
}

function DifficultyChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full px-2.5 py-0.5 text-xs border transition-colors',
        active ? 'border-accent/50 text-accent bg-accent/10' : 'border-edge text-ink-muted hover:border-edge-strong',
      )}
    >
      {label}
    </button>
  );
}

function DifficultyBadge({ level }: { level: 1 | 2 | 3 }) {
  const dots = '●'.repeat(level) + '○'.repeat(3 - level);
  const color = level === 1 ? 'text-good' : level === 2 ? 'text-accent' : 'text-bad';
  return <span className={clsx('font-mono text-[10px]', color)}>{dots}</span>;
}
