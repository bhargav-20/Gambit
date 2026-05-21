import { useGameStore } from '@/core/store/gameStore';
import type { Promotable } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { findPieceSet } from '@/features/themes/piecesets';
import type { PieceCode } from '@/features/themes/piecesets';

/**
 * Floating overlay that lets the user pick Q/R/B/N when a pawn reaches the
 * back rank in edit mode. Positions itself in the file of the promotion
 * square, anchored to the side of the board where the promotion lands.
 */
export function PromotionPicker() {
  const pending = useGameStore((s) => s.pendingPromotion);
  const orientation = useGameStore((s) => s.orientation);
  const resolve = useGameStore((s) => s.resolvePromotion);
  const cancel = useGameStore((s) => s.cancelPromotion);
  const pieceSetId = useUiStore((s) => s.pieceSet);
  const set = findPieceSet(pieceSetId);

  if (!pending) return null;

  const fileIdx = pending.to.charCodeAt(0) - 'a'.charCodeAt(0); // 0..7
  // Column the promotion square sits in, accounting for board orientation.
  const colFromLeft = orientation === 'white' ? fileIdx : 7 - fileIdx;
  // Side of the board: white promotes to rank 8 (top in default orientation).
  const promotingOnTop =
    (pending.color === 'w' && orientation === 'white') ||
    (pending.color === 'b' && orientation === 'black');

  const choices: Promotable[] = ['q', 'r', 'b', 'n'];
  const pieceCodeFor = (c: Promotable): PieceCode =>
    `${pending.color}${c.toUpperCase()}` as PieceCode;

  // Each square is 12.5% wide. Anchor the picker column to the promotion file.
  const left = `${colFromLeft * 12.5}%`;
  const positional = promotingOnTop
    ? { top: 0, flexDirection: 'column' as const }
    : { bottom: 0, flexDirection: 'column-reverse' as const };

  return (
    <>
      {/* Click-outside dismiss */}
      <button
        aria-label="Cancel promotion"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px] cursor-default z-10"
        onClick={cancel}
      />
      <div
        className="absolute z-20 flex w-[12.5%] shadow-2xl rounded-lg overflow-hidden border border-edge-strong bg-bg-raised"
        style={{ left, ...positional }}
      >
        {choices.map((c) => (
          <button
            key={c}
            onClick={() => resolve(c)}
            className="aspect-square w-full flex items-center justify-center hover:bg-accent/20 transition-colors"
            title={c.toUpperCase()}
          >
            <img
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(set.pieces[pieceCodeFor(c)])}`}
              alt={c.toUpperCase()}
              className="w-[88%] h-[88%]"
              draggable={false}
            />
          </button>
        ))}
      </div>
    </>
  );
}
