import { useEffect } from 'react';
import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { useAnalysisStore } from '@/core/store/analysisStore';
import { loadEmpty, STARTPOS } from '@/core/chess/pgn';
import { Microscope, Eye, EyeOff, Target, Loader2, AlertTriangle, PlusSquare, RotateCcw, Undo2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * Right-panel content for the Analyze route. Hosts engine controls:
 *
 *   - Tri-state best-move visibility: Off / Always / This move.
 *     The "This move" state auto-resets to Off on the next ply change
 *     (handled by `useBestMoveOnceAutoReset` below) so users can peek at
 *     the engine's recommendation without committing to permanent
 *     visualization.
 *
 *   - Live engine status (eval, depth, busy).
 *
 *   - Principal variation up to a few moves so the user can see the
 *     engine's plan, not just its top move.
 */
export function AnalyzePanel() {
  useBestMoveOnceAutoReset();

  const bestMoveDisplay = useUiStore((s) => s.bestMoveDisplay);
  const setBestMoveDisplay = useUiStore((s) => s.setBestMoveDisplay);
  const snapshot = useAnalysisStore((s) => s.snapshot);
  const busy = useAnalysisStore((s) => s.busy);
  const failed = useAnalysisStore((s) => s.failed);
  const mode = useGameStore((s) => s.mode);
  const branchPly = useGameStore((s) => s.branchPly);
  const backToGame = useGameStore((s) => s.backToGame);
  const undoMove = useGameStore((s) => s.undoMove);
  const moveCount = useGameStore((s) => s.game.moves.length);
  const loadGame = useGameStore((s) => s.loadGame);
  const analyzeGame = useGameStore((s) => s.analyzeGame);

  const label = formatLabel(snapshot?.cp ?? null, snapshot?.mate ?? null);
  const depth = snapshot?.depth ?? 0;
  const engineActive = mode === 'analyze' || mode === 'composer';
  const branched = branchPly !== null;
  const canUndo = moveCount > 0;

  const newEmptyBoard = () => {
    // Drop the current game in favor of a clean starting position. Snapshot
    // is re-created via analyzeGame() so future branches still have a
    // reference point (the empty board itself becomes the "original").
    loadGame(loadEmpty(STARTPOS, { title: 'Fresh board', source: 'editor' }));
    analyzeGame();
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Microscope size={16} className="text-accent" />
        <h2 className="font-display text-lg">Engine</h2>
      </div>

      {/* Board actions — always visible at the top so the user has the
          "I want to tinker" affordance right where they look first. */}
      <div className="flex flex-col gap-1.5">
        <button className="btn text-xs justify-center gap-1.5" onClick={newEmptyBoard}>
          <PlusSquare size={12} /> New empty board
        </button>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="btn h-8 text-xs justify-center gap-1.5"
            onClick={undoMove}
            disabled={!canUndo}
            title="Pop the last move"
          >
            <Undo2 size={12} /> Undo
          </button>
          <button
            className="btn h-8 text-xs justify-center gap-1.5"
            onClick={backToGame}
            disabled={!branched}
            title={branched
              ? `Restore the original game and jump to move ${Math.ceil((branchPly ?? 0) / 2)}`
              : 'No branch yet — make a move to start exploring variations'}
          >
            <RotateCcw size={12} /> Back to game
          </button>
        </div>
      </div>

      {/* Eval + depth at a glance */}
      <div className="panel-tight p-3 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Evaluation</div>
          <div className="font-mono font-semibold text-2xl text-accent tabular-nums leading-none mt-1">
            {failed ? '—' : label}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-ink-muted">Depth</div>
          <div className="font-mono text-base text-ink mt-1 flex items-center gap-1 justify-end">
            {depth}
            {busy && !snapshot?.done && <Loader2 size={12} className="animate-spin text-accent" />}
          </div>
        </div>
      </div>

      {failed && (
        <div className="panel-tight border-bad/40 bg-bad/5 p-2.5 text-xs text-bad flex items-start gap-2">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span>Engine failed to load. Refresh the page if this persists.</span>
        </div>
      )}

      {/* Tri-state best-move toggle — the centerpiece of this panel */}
      <div>
        <div className="label mb-1.5">Best move arrow</div>
        <div className="grid grid-cols-3 gap-1 panel-tight p-1">
          <SegmentButton
            active={bestMoveDisplay === 'off'}
            onClick={() => setBestMoveDisplay('off')}
            icon={<EyeOff size={12} />}
            label="Off"
          />
          <SegmentButton
            active={bestMoveDisplay === 'on'}
            onClick={() => setBestMoveDisplay('on')}
            icon={<Eye size={12} />}
            label="Always"
            disabled={!engineActive}
          />
          <SegmentButton
            active={bestMoveDisplay === 'once'}
            onClick={() => setBestMoveDisplay('once')}
            icon={<Target size={12} />}
            label="This move"
            disabled={!engineActive}
            title="Show the arrow for this position only. Resets on your next move."
          />
        </div>
        {bestMoveDisplay === 'once' && (
          <p className="text-[10px] text-ink-faint mt-1.5 px-0.5">
            Arrow shown for this position — hides automatically after your next move.
          </p>
        )}
      </div>

      {/* Principal variation — gives the engine's plan, not just one move */}
      {snapshot?.pv && snapshot.pv.length > 0 && (
        <div>
          <div className="label mb-1.5">Engine line</div>
          <div className="panel-tight p-2.5 font-mono text-xs text-ink-muted leading-relaxed">
            {snapshot.pv.slice(0, 8).join(' ')}
            {snapshot.pv.length > 8 && <span className="text-ink-faint">…</span>}
          </div>
        </div>
      )}

      {!snapshot && engineActive && !failed && (
        <div className="text-xs text-ink-muted text-center py-4">
          <Loader2 size={14} className="animate-spin text-accent inline mr-1" />
          Engine loading…
        </div>
      )}
    </div>
  );
}

function SegmentButton({
  active, onClick, icon, label, disabled, title,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={clsx(
        'rounded-md px-2 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors',
        active
          ? 'bg-accent text-bg'
          : 'text-ink-muted hover:text-ink hover:bg-bg-subtle disabled:hover:bg-transparent disabled:text-ink-faint disabled:cursor-not-allowed',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

/**
 * One-shot reset: whenever the ply changes while bestMoveDisplay === 'once',
 * flip it back to 'off'. Mounted by AnalyzePanel so it only runs while the
 * panel is on screen — keeps the behavior scoped to the analyze surface and
 * avoids surprises elsewhere.
 *
 * Tracks the last seen ply via a closure variable instead of useRef so the
 * effect dependency stays clean.
 */
function useBestMoveOnceAutoReset() {
  const ply = useGameStore((s) => s.ply);
  useEffect(() => {
    const ui = useUiStore.getState();
    if (ui.bestMoveDisplay === 'once') ui.setBestMoveDisplay('off');
    // Intentionally only depending on ply — the effect should fire on
    // navigation between positions, not on the user toggling the state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ply]);
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
