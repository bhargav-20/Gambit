import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { useAnalysisStore } from '@/core/store/analysisStore';
import {
  Pencil, X, Eye, EyeOff, Loader2, Undo2, Microscope, RotateCcw,
} from 'lucide-react';
import clsx from 'clsx';

/**
 * Strip that sits below the playback controls. Renders different content
 * for each mode:
 *
 *   visualizer: two stacked buttons — "Analyze this game" (study with
 *               branching + back-to-game) and "Compose from here" (free
 *               play that becomes the user's composition).
 *
 *   composer:   panel with eval, Undo, Show best move toggle, X (exit).
 *
 *   analyze:    panel with eval, Undo, Show best move toggle, "Back to game"
 *               (restores the snapshot at the branch ply), X (exit).
 *
 *   puzzle:     nothing — the puzzle owns the right column.
 */
export function ComposerBar() {
  const mode = useGameStore((s) => s.mode);

  if (mode === 'puzzle') return null;
  if (mode === 'composer') return <ComposerPanel />;
  if (mode === 'analyze') return <AnalyzePanel />;
  return <VisualizerActions />;
}

/** Alias kept so older callers (App.tsx) don't have to change their import. */
export { ComposerBar as AnalysisBar };

function VisualizerActions() {
  const composeFromHere = useGameStore((s) => s.composeFromHere);
  const analyzeGame = useGameStore((s) => s.analyzeGame);
  const hasMoves = useGameStore((s) => s.game.moves.length > 0);

  return (
    <div className="flex flex-col gap-2">
      <button
        className="btn justify-center gap-2"
        onClick={analyzeGame}
        disabled={!hasMoves}
        title={hasMoves ? 'Study this game with branching and engine help' : 'Load a game first'}
      >
        <Microscope size={14} className="text-accent" />
        Analyze this game
      </button>
      <button
        className="btn justify-center gap-2"
        onClick={composeFromHere}
        title="Take the current position into the composer for free play"
      >
        <Pencil size={14} className="text-accent" />
        Compose from here
      </button>
    </div>
  );
}

function ComposerPanel() {
  const exitComposer = useGameStore((s) => s.exitComposer);
  const undoMove = useGameStore((s) => s.undoMove);
  const moveCount = useGameStore((s) => s.game.moves.length);
  const canUndo = moveCount > 0;
  const showBestMove = useUiStore((s) => s.showBestMove);
  const setShowBestMove = useUiStore((s) => s.setShowBestMove);
  const snapshot = useAnalysisStore((s) => s.snapshot);
  const busy = useAnalysisStore((s) => s.busy);
  const failed = useAnalysisStore((s) => s.failed);

  const label = formatLabel(snapshot?.cp ?? null, snapshot?.mate ?? null);
  const depth = snapshot?.depth ?? 0;

  return (
    <div className="panel p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Pencil size={14} className="text-accent shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-ink font-medium">Composing</div>
            <div className="text-[10px] text-ink-muted">
              Free play — Exit returns to visualizer with your composition.
            </div>
          </div>
        </div>
        <button
          className="btn-icon shrink-0"
          onClick={() => { setShowBestMove(false); exitComposer(); }}
          title="Exit composer"
        >
          <X size={14} />
        </button>
      </div>

      <EngineStatus label={label} depth={depth} busy={busy} failed={failed} done={!!snapshot?.done} />

      <div className="grid grid-cols-2 gap-2">
        <button onClick={undoMove} className="btn h-8 text-xs justify-center gap-1.5" disabled={!canUndo}>
          <Undo2 size={12} /> Undo
        </button>
        <BestMoveToggle showBestMove={showBestMove} setShowBestMove={setShowBestMove} disabled={!snapshot?.bestMove} />
      </div>
    </div>
  );
}

function AnalyzePanel() {
  const exitAnalyze = useGameStore((s) => s.exitAnalyze);
  const backToGame = useGameStore((s) => s.backToGame);
  const undoMove = useGameStore((s) => s.undoMove);
  const branchPly = useGameStore((s) => s.branchPly);
  const moveCount = useGameStore((s) => s.game.moves.length);
  const canUndo = moveCount > 0;
  const branched = branchPly !== null;
  const showBestMove = useUiStore((s) => s.showBestMove);
  const setShowBestMove = useUiStore((s) => s.setShowBestMove);
  const snapshot = useAnalysisStore((s) => s.snapshot);
  const busy = useAnalysisStore((s) => s.busy);
  const failed = useAnalysisStore((s) => s.failed);

  const label = formatLabel(snapshot?.cp ?? null, snapshot?.mate ?? null);
  const depth = snapshot?.depth ?? 0;

  return (
    <div className="panel p-3 flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Microscope size={14} className="text-accent shrink-0" />
          <div className="min-w-0">
            <div className="text-xs text-ink font-medium">Analyzing</div>
            <div className="text-[10px] text-ink-muted">
              {branched
                ? `Branched at move ${Math.ceil((branchPly ?? 0) / 2)} — Back to game restores it.`
                : 'Play a move to branch and explore variations.'}
            </div>
          </div>
        </div>
        <button
          className="btn-icon shrink-0"
          onClick={() => { setShowBestMove(false); exitAnalyze(); }}
          title="Exit analyze mode"
        >
          <X size={14} />
        </button>
      </div>

      <EngineStatus label={label} depth={depth} busy={busy} failed={failed} done={!!snapshot?.done} />

      <div className="grid grid-cols-2 gap-2">
        <button onClick={undoMove} className="btn h-8 text-xs justify-center gap-1.5" disabled={!canUndo}>
          <Undo2 size={12} /> Undo
        </button>
        <BestMoveToggle showBestMove={showBestMove} setShowBestMove={setShowBestMove} disabled={!snapshot?.bestMove} />
      </div>

      <button
        onClick={backToGame}
        className="btn h-8 text-xs justify-center gap-1.5"
        disabled={!branched}
        title={branched ? 'Restore the original game and jump to the branch point' : 'No branch yet'}
      >
        <RotateCcw size={12} /> Back to game
      </button>
    </div>
  );
}

function EngineStatus({
  label, depth, busy, failed, done,
}: {
  label: string; depth: number; busy: boolean; failed: boolean; done: boolean;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-mono font-semibold text-accent tabular-nums w-12">
        {failed ? '—' : label}
      </span>
      <span className="text-ink-faint">
        {failed ? 'engine failed' : busy && !done ? 'thinking…' : `depth ${depth}`}
      </span>
      {busy && !done && <Loader2 size={12} className="animate-spin text-accent" />}
    </div>
  );
}

function BestMoveToggle({
  showBestMove, setShowBestMove, disabled,
}: {
  showBestMove: boolean; setShowBestMove: (v: boolean) => void; disabled: boolean;
}) {
  return (
    <button
      onClick={() => setShowBestMove(!showBestMove)}
      className={clsx(
        'btn h-8 text-xs justify-center gap-1.5',
        showBestMove && 'border-accent text-accent bg-accent/10',
      )}
      disabled={disabled}
    >
      {showBestMove ? <EyeOff size={12} /> : <Eye size={12} />}
      {showBestMove ? 'Hide best' : 'Best move'}
    </button>
  );
}

function formatLabel(cp: number | null, mate: number | null): string {
  if (mate !== null) {
    const sign = mate > 0 ? '' : '-';
    return `M${sign}${Math.abs(mate)}`;
  }
  if (cp === null) return '0.0';
  const pawns = cp / 100;
  const sign = pawns >= 0 ? '+' : '';
  return `${sign}${pawns.toFixed(1)}`;
}
