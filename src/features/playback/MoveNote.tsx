import { useGameStore } from '@/core/store/gameStore';
import { findOpening } from '@/features/openings/catalog';
import { findGame } from '@/features/games/catalog';
import { Lightbulb } from 'lucide-react';

/**
 * Contextual card showing the commentary for the currently-active move in
 * the loaded opening. Reserves a stable visual area so playback controls
 * above/below it don't shift as commentary length varies — when there's
 * nothing to say (no opening loaded, first ply, or no note for this ply),
 * a quiet placeholder occupies the same space.
 */
export function MoveNote() {
  const meta = useGameStore((s) => s.game.meta);
  const ply = useGameStore((s) => s.ply);
  const moves = useGameStore((s) => s.game.moves);
  const mode = useGameStore((s) => s.mode);

  // Opening commentary is irrelevant when solving a puzzle — the puzzle owns
  // the right column with its own instructions.
  if (mode === 'puzzle') return null;

  // Two sources of per-move commentary: the openings catalog (for loaded
  // preset openings) and the famous-games catalog. Famous-game notes win
  // when both are present — the user is in the more specific context.
  const opening = meta.openingId ? findOpening(meta.openingId) : undefined;
  const famousGame = meta.gameId ? findGame(meta.gameId) : undefined;
  const note = famousGame?.moveNotes?.[ply - 1] ?? opening?.moveNotes?.[ply - 1];
  const move = ply > 0 ? moves[ply - 1] : undefined;
  const moveNumber = ply > 0 ? Math.floor((ply - 1) / 2) + 1 : 0;
  const isWhite = (ply - 1) % 2 === 0;
  const dot = isWhite ? '.' : '…';

  return (
    <div className="panel p-3 text-sm leading-relaxed min-h-[96px] max-h-[200px] overflow-y-auto shrink-0">
      <div className="flex items-center gap-2 mb-1.5">
        <Lightbulb size={12} className="text-accent shrink-0" />
        {move ? (
          <span className="font-mono text-xs text-accent">
            {moveNumber}{dot} {move.san}
          </span>
        ) : (
          <span className="font-mono text-xs text-ink-faint uppercase tracking-wider">
            Move commentary
          </span>
        )}
      </div>
      {note ? (
        <p className="text-ink">{note}</p>
      ) : (
        <p className="text-ink-faint italic">
          {ply === 0
            ? 'Press play or step forward to see commentary for each move.'
            : famousGame
              ? 'No note for this move — keep stepping forward to the highlights.'
              : opening
                ? 'No note for this move yet — keep stepping forward.'
                : 'Load a preset opening or famous game to see move-by-move commentary.'}
        </p>
      )}
    </div>
  );
}
