import { useEffect, useRef } from 'react';
import { Chessground } from 'chessground';
import type { Api } from 'chessground/api';
import type { Config } from 'chessground/config';
import type { Key } from 'chessground/types';
import { Chess } from 'chess.js';
import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { usePuzzleStore } from '@/core/store/puzzleStore';
import { useAnalysisStore } from '@/core/store/analysisStore';
import { dests, turnColor } from '@/core/chess/legal';
import type { Square } from '@/core/chess/types';
import { PromotionPicker } from './PromotionPicker';
import { CoordOverlay } from './CoordOverlay';

function pieceCodeAt(fen: string, square: string): { piece: string; color: 'w' | 'b' } | null {
  const board = fen.split(' ')[0];
  const rows = board.split('/');
  const fileIdx = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const rankIdx = 8 - parseInt(square[1], 10);
  const row = rows[rankIdx];
  let f = 0;
  for (const ch of row) {
    if (/\d/.test(ch)) { f += parseInt(ch, 10); continue; }
    if (f === fileIdx) {
      return { piece: ch.toLowerCase(), color: ch === ch.toUpperCase() ? 'w' : 'b' };
    }
    f++;
  }
  return null;
}

interface Props {
  /** Constrain the board to a square area inside the parent. */
  maxSize?: number;
}

export function Board2D({ maxSize }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<Api | null>(null);

  const game = useGameStore((s) => s.game);
  const ply = useGameStore((s) => s.ply);
  const editMode = useGameStore((s) => s.editMode);
  const orientation = useGameStore((s) => s.orientation);
  const applyMove = useGameStore((s) => s.applyMove);
  const requestPromotion = useGameStore((s) => s.requestPromotion);
  const showCoords = useUiStore((s) => s.showCoords);
  const showLastMove = useUiStore((s) => s.showLastMove);
  const showLegalDots = useUiStore((s) => s.showLegalDots);
  const showBestMove = useUiStore((s) => s.showBestMove);
  const animationMs = useUiStore((s) => s.animationMs);
  const mode = useGameStore((s) => s.mode);
  const bestMove = useAnalysisStore((s) => s.snapshot?.bestMove ?? null);

  // Mount chessground once.
  useEffect(() => {
    if (!hostRef.current) return;
    const fen = useGameStore.getState().currentFen();
    const last = useGameStore.getState().lastMoveSquares();
    const config: Config = {
      fen,
      // chessground's configure() does NOT read side-to-move from the FEN —
      // it just updates pieces. We have to pass turnColor explicitly so that
      // canMove() (which compares state.turnColor to piece.color) accepts
      // moves by the actual side to move.
      turnColor: turnColor(fen),
      orientation,
      coordinates: true,                    // always rendered; CSS hides them when toggled off
      lastMove: last ? [last[0], last[1]] : undefined,
      animation: { enabled: true, duration: animationMs },
      movable: {
        free: false,
        color: editMode ? turnColor(fen) : undefined,
        dests: editMode ? dests(fen) : new Map(),
        showDests: showLegalDots,
        events: {
          after: (from, to) => {
            // Detect promotion: a pawn moving to the back rank for its color.
            const beforeFen = useGameStore.getState().currentFen();
            const moved = pieceCodeAt(beforeFen, from);
            const isPromotion =
              moved?.piece === 'p' &&
              ((moved.color === 'w' && to[1] === '8') ||
                (moved.color === 'b' && to[1] === '1'));
            if (isPromotion && moved) {
              // Hold the move open and ask the user which piece to promote to.
              apiRef.current?.set({ fen: beforeFen });
              requestPromotion(from as Square, to as Square, moved.color);
              return;
            }

            // Puzzle mode: validate the move against the expected solution
            // before letting it touch the main game state.
            const puzzle = usePuzzleStore.getState();
            if (puzzle.active && puzzle.status !== 'solved') {
              const probe = new Chess(beforeFen);
              const moveResult = probe.move({ from, to, promotion: 'q' });
              if (!moveResult) {
                apiRef.current?.set({ fen: beforeFen });
                return;
              }
              const verdict = puzzle.checkMove(moveResult.san);
              if (verdict === 'wrong') {
                puzzle.markWrong(moveResult.san);
                apiRef.current?.set({ fen: beforeFen });
                return;
              }
              // Correct — apply, then auto-play the opponent's scripted reply.
              const ok = applyMove(from as Square, to as Square);
              if (!ok) {
                apiRef.current?.set({ fen: beforeFen });
                return;
              }
              puzzle.advance();
              const after = usePuzzleStore.getState();
              if (after.status === 'in_progress' && after.active) {
                const opponentSan = after.active.solution[after.expectedIndex - 1];
                if (opponentSan) {
                  // Apply the opponent reply on a small delay for animation visibility.
                  setTimeout(() => {
                    const replyFen = useGameStore.getState().currentFen();
                    const c = new Chess(replyFen);
                    const reply = c.move(opponentSan);
                    if (reply) {
                      applyMove(reply.from as Square, reply.to as Square, reply.promotion as 'q' | 'r' | 'b' | 'n' | undefined);
                    }
                  }, 300);
                }
              }
              return;
            }

            const ok = applyMove(from as Square, to as Square);
            if (!ok) {
              // chessground already moved the piece visually; revert by re-syncing.
              apiRef.current?.set({ fen: useGameStore.getState().currentFen() });
            }
          },
        },
      },
      draggable: { showGhost: true, enabled: true },
      drawable: { enabled: true, visible: true, eraseOnClick: true },
      highlight: { lastMove: true, check: true },   // CSS controls visibility from the toggle
    };
    apiRef.current = Chessground(hostRef.current, config);
    return () => {
      apiRef.current?.destroy();
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync FEN + lastMove + side-to-move when ply / game changes. The
  // turnColor MUST be passed alongside the new fen — chessground's set()
  // updates piece positions from the FEN but leaves turnColor alone,
  // which would otherwise stick on white forever and reject black's moves.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    const fen = useGameStore.getState().currentFen();
    const last = useGameStore.getState().lastMoveSquares();
    const tc = turnColor(fen);
    api.set({
      fen,
      turnColor: tc,
      lastMove: last ? ([last[0], last[1]] as Key[]) : undefined,
      animation: { enabled: true, duration: animationMs },
      movable: {
        color: editMode ? tc : undefined,
        dests: editMode ? dests(fen) : new Map(),
        showDests: showLegalDots,
      },
    });
  }, [game, ply, editMode, showLegalDots, animationMs]);

  // Sync orientation.
  useEffect(() => {
    apiRef.current?.set({ orientation });
  }, [orientation]);

  // Draw the engine's best-move arrow ONLY when the user has explicitly asked
  // for it (Show best move button) AND we're in Analysis mode AND the engine
  // has produced a move. Otherwise clear any stale shape.
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    if ((mode !== 'composer' && mode !== 'analyze') || !showBestMove || !bestMove) {
      api.setAutoShapes([]);
      return;
    }
    const from = bestMove.slice(0, 2) as Key;
    const to = bestMove.slice(2, 4) as Key;
    // Use chessground's solid 'blue' brush (more saturated than paleBlue) and
    // refine via CSS in chessgroundBase.css so the arrow body and head are
    // chunkier than the default.
    api.setAutoShapes([{ orig: from, dest: to, brush: 'blue' }]);
  }, [mode, showBestMove, bestMove]);

  // Reserve space on the right (ranks) and bottom (files) for coord labels so
  // they sit OUTSIDE the board rather than overlapping pieces. When coords are
  // hidden the inset goes back to zero so the board fills the whole shell.
  const coordPad = showCoords ? 18 : 0;

  return (
    <div
      className="board-shell relative aspect-square w-full"
      data-show-coords={showCoords ? 'true' : 'false'}
      data-show-last-move={showLastMove ? 'true' : 'false'}
      style={
        {
          maxWidth: maxSize ? `${maxSize}px` : undefined,
          '--coord-right': `${coordPad}px`,
          '--coord-bottom': `${coordPad}px`,
        } as React.CSSProperties
      }
    >
      {/* Outer wrapper carries the inset; chessground will take over the
          inner host div and size itself to fill this wrapper exactly. */}
      <div
        className="absolute top-0 left-0"
        style={{
          right: `${coordPad}px`,
          bottom: `${coordPad}px`,
          boxShadow: 'var(--cg-shadow)',
        }}
      >
        <div ref={hostRef} className="absolute inset-0" />
      </div>
      <PromotionPicker />
      {showCoords && <CoordOverlay orientation={orientation} padPx={coordPad} />}
    </div>
  );
}
