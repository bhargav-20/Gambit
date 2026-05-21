import { useAnalysisStore } from '@/core/store/analysisStore';
import { useGameStore } from '@/core/store/gameStore';
import clsx from 'clsx';

/**
 * Vertical bar showing engine evaluation: white fills from the bottom, black
 * from the top. A tanh squash maps centipawns to a 0..1 fill ratio so the bar
 * doesn't peg at full-white for a +3 advantage that's still recoverable.
 *
 * Sits flush against the board's left edge — only rendered when the user is
 * in the Analysis sandbox.
 */
export function EvalBar() {
  const mode = useGameStore((s) => s.mode);
  const snapshot = useAnalysisStore((s) => s.snapshot);
  const busy = useAnalysisStore((s) => s.busy);
  const failed = useAnalysisStore((s) => s.failed);

  if (mode !== 'composer' && mode !== 'analyze') return null;

  const whiteFraction = computeWhiteFraction(snapshot?.cp ?? null, snapshot?.mate ?? null);
  const label = formatLabel(snapshot?.cp ?? null, snapshot?.mate ?? null);

  return (
    <div
      className="rounded-md overflow-hidden border border-edge bg-bg-subtle"
      title={failed ? 'Engine failed to load' : `Depth ${snapshot?.depth ?? 0}`}
      aria-label={`Evaluation ${label}`}
      style={{
        position: 'absolute',
        right: '100%',
        top: 0,
        bottom: 0,
        width: '22px',
        marginRight: '8px',
      }}
    >
      {/* Black slab fills from the top down */}
      <div
        className="absolute inset-x-0 top-0 bg-[#1c1c20] transition-[height] duration-200 ease-out"
        style={{ height: `${(1 - whiteFraction) * 100}%` }}
      />
      {/* White slab fills from the bottom up */}
      <div
        className="absolute inset-x-0 bottom-0 bg-[#f3eada] transition-[height] duration-200 ease-out"
        style={{ height: `${whiteFraction * 100}%` }}
      />
      {/* Center line for visual reference at equality */}
      <div className="absolute inset-x-0 top-1/2 h-px bg-accent/40" />
      {/* Score label — placed in the larger half so it stays readable */}
      <div
        className={clsx(
          'absolute inset-x-0 text-center text-[10px] font-mono font-semibold tabular-nums',
          whiteFraction >= 0.5 ? 'bottom-1 text-bg' : 'top-1 text-ink',
        )}
      >
        {failed ? '?' : label}
      </div>
      {busy && !snapshot?.done && (
        <div className="absolute top-1 inset-x-0 flex justify-center">
          <div className="h-1 w-1 rounded-full bg-accent animate-pulse" />
        </div>
      )}
    </div>
  );
}

/** tanh-shaped mapping: ±400cp → ~0.95 fill, ±1000cp → ~0.99 fill. */
function computeWhiteFraction(cp: number | null, mate: number | null): number {
  if (mate !== null) {
    if (mate > 0) return 1;
    if (mate < 0) return 0;
    return 0.5;
  }
  if (cp === null) return 0.5;
  // Squash centipawns. 100cp ≈ 0.62 fill, 300cp ≈ 0.85, 700cp ≈ 0.97.
  const t = Math.tanh(cp / 400);
  return 0.5 + t * 0.5;
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
