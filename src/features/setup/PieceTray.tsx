import { useSetupStore } from '@/core/store/setupStore';
import type { FenPiece, ArmedTool } from '@/core/store/setupStore';
import { useUiStore } from '@/core/store/uiStore';
import { findPieceSet } from '@/features/themes/piecesets';
import type { PieceCode } from '@/features/themes/piecesets';
import { Eraser } from 'lucide-react';
import clsx from 'clsx';

const WHITE_ROW: FenPiece[] = ['K', 'Q', 'R', 'B', 'N', 'P'];
const BLACK_ROW: FenPiece[] = ['k', 'q', 'r', 'b', 'n', 'p'];

function fenToPieceCode(p: FenPiece): PieceCode {
  const color = p === p.toUpperCase() ? 'w' : 'b';
  return `${color}${p.toUpperCase()}` as PieceCode;
}

/**
 * Piece-selector strip for the setup view. Tapping a piece "arms" it — the
 * next board-square tap places the armed piece. The Eraser cell empties any
 * square it's tapped on. Tap the active tool again to disarm.
 *
 * Drag-from-tray is intentionally deferred to v2; click-to-arm covers the
 * 95% case and stays clean across desktop and touch.
 */
export function PieceTray() {
  const armed = useSetupStore((s) => s.armed);
  const setArmed = useSetupStore((s) => s.setArmed);
  const pieceSetId = useUiStore((s) => s.pieceSet);
  const set = findPieceSet(pieceSetId);

  const onPick = (next: ArmedTool) => {
    setArmed(armed === next ? null : next);
  };

  return (
    <div className="panel p-2.5 flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] uppercase tracking-wider text-ink-muted">
          {armed === null ? 'Tap a piece, then a square' : armed === 'eraser' ? 'Eraser armed' : `Armed: ${armed}`}
        </span>
        <button
          type="button"
          className={clsx(
            'rounded-md p-1.5 transition-colors',
            armed === 'eraser'
              ? 'bg-accent/20 text-accent ring-1 ring-accent/40'
              : 'text-ink-muted hover:bg-bg-subtle hover:text-ink',
          )}
          title="Eraser — tap, then tap a square to clear it"
          onClick={() => onPick('eraser')}
        >
          <Eraser size={14} />
        </button>
      </div>
      <TrayRow pieces={WHITE_ROW} armed={armed} onPick={onPick} set={set} />
      <TrayRow pieces={BLACK_ROW} armed={armed} onPick={onPick} set={set} />
    </div>
  );
}

function TrayRow({
  pieces, armed, onPick, set,
}: {
  pieces: FenPiece[];
  armed: ArmedTool;
  onPick: (p: ArmedTool) => void;
  set: { pieces: Record<PieceCode, string> };
}) {
  return (
    <div className="grid grid-cols-6 gap-1.5">
      {pieces.map((p) => {
        const code = fenToPieceCode(p);
        const svg = set.pieces[code];
        const dataUri = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}")`;
        const active = armed === p;
        return (
          <button
            key={p}
            type="button"
            className={clsx(
              'aspect-square rounded-md border transition-colors',
              active
                ? 'border-accent/60 bg-accent/15'
                : 'border-edge hover:border-edge-strong bg-bg-subtle',
            )}
            style={{
              backgroundImage: dataUri,
              backgroundSize: '78%',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
            onClick={() => onPick(p)}
            title={`${p === p.toUpperCase() ? 'White' : 'Black'} ${{ K: 'king', Q: 'queen', R: 'rook', B: 'bishop', N: 'knight', P: 'pawn' }[p.toUpperCase() as 'K' | 'Q' | 'R' | 'B' | 'N' | 'P']}`}
            aria-pressed={active}
          />
        );
      })}
    </div>
  );
}
