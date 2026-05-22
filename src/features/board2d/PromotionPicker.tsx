import { Chess } from 'chess.js';
import { useGameStore } from '@/core/store/gameStore';
import type { Promotable } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { usePuzzleStore } from '@/core/store/puzzleStore';
import { findPieceSet } from '@/features/themes/piecesets';
import type { PieceCode } from '@/features/themes/piecesets';
import type { Square } from '@/core/chess/types';
import { sendLocalMove } from '@/features/pvp/session';

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

  const onPick = (c: Promotable) => {
    const gameState = useGameStore.getState();
    const wasPvp = gameState.mode === 'pvp';
    const wasPuzzle = gameState.mode === 'puzzle';
    const from = pending.from;
    const to = pending.to;

    // Puzzle gating for promotion moves. Board2D's drag-after-handler
    // already does this for non-promotion moves, but for promotions it
    // returns early (to surface the picker), so the validation has to
    // happen here when the user actually commits a piece. Without this,
    // any promotion move plays without being checked against the puzzle
    // solution — that's the bug that left promotion-trick unsolvable.
    if (wasPuzzle) {
      const puzzle = usePuzzleStore.getState();
      const active = puzzle.active;
      const activeAndUnfinished =
        active && (puzzle.status === 'in_progress' || puzzle.status === 'wrong');
      if (activeAndUnfinished) {
        // Probe the SAN of the promotion move from the pre-move FEN so the
        // string we compare against the solution matches exactly (with the
        // user's chosen piece). chess.js's normalizer matches our
        // puzzleStore.checkMove normalizer for +/# decoration.
        const beforeFen = gameState.currentFen();
        const probe = new Chess(beforeFen);
        const result = probe.move({ from, to, promotion: c });
        if (!result) {
          cancel();
          return;
        }
        const verdict = puzzle.checkMove(result.san);
        if (verdict === 'wrong') {
          puzzle.markWrong(result.san);
          cancel();  // closes the picker; board was already snapped back when picker opened
          window.setTimeout(() => usePuzzleStore.getState().clearWrong(), 1400);
          return;
        }
        // Correct — apply the move through the same store action the
        // picker normally uses, then advance the puzzle. After advancing,
        // run the puzzle's scripted opponent reply (if any) the same way
        // Board2D does for non-promotion moves.
        resolve(c);
        puzzle.advance();
        const after = usePuzzleStore.getState();
        if (after.status === 'in_progress' && after.active) {
          const opponentSan = after.active.solution[after.expectedIndex - 1];
          if (opponentSan) {
            setTimeout(() => {
              const replyFen = useGameStore.getState().currentFen();
              const cc = new Chess(replyFen);
              const reply = cc.move(opponentSan);
              if (reply) {
                useGameStore.getState().applyMove(
                  reply.from as Square,
                  reply.to as Square,
                  reply.promotion as Promotable | undefined,
                );
              }
            }, 300);
          }
        }
        return;
      }
    }

    resolve(c);
    // In PvP, resolvePromotion has already pushed the move through applyMove;
    // ship the UCI (with promotion char) over the wire so the opponent applies it.
    if (wasPvp) {
      sendLocalMove(`${from}${to}${c}`);
    }
  };

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
            onClick={() => onPick(c)}
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
