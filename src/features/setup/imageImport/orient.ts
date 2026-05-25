import type { DetectedGrid } from './types';
import type { FenPiece } from '@/core/store/setupStore';

/**
 * Decide whether a detected grid needs to be rotated 180° to match the
 * normal "white-at-bottom" convention the editor expects.
 *
 * The classifier returns ranks indexed image-top → image-bottom (rank 0 is
 * the topmost row of pixels). In a normal Lichess / Chess.com screenshot
 * viewed from White's side, that row IS the 8th rank — black's back row —
 * which means the detected `[0][...]` should contain the black pieces.
 *
 * If the source was a screenshot viewed from Black's side instead, the
 * detected grid would have white's pieces at the image-top → we need to
 * rotate 180° before writing the FEN.
 *
 * Heuristic, in order of trust:
 *   1. Kings: if a black king is in rank 0–1 and a white king in rank 6–7,
 *      we're oriented. Inverted → flip. Anything else (one king or both on
 *      the same side) falls through.
 *   2. Piece-color mass: count pieces of each color in the top vs bottom
 *      halves. If the BOTTOM half has more black pieces than white,
 *      that's a flipped board → rotate.
 *   3. Otherwise leave the grid alone.
 *
 * Never flips a board we're not confident about — false flips are jarring
 * to the user; missed flips just leave them to hit the manual Flip button.
 */
export interface OrientResult {
  grid: DetectedGrid;
  /** True iff the grid was rotated. */
  flipped: boolean;
  /** Why we made the decision — surfaced to the UI as a small note. */
  reason: 'kings' | 'mass' | 'unsure';
}

export function autoOrient(grid: DetectedGrid): OrientResult {
  const kings = findKings(grid);
  if (kings.white && kings.black) {
    const blackOnTop = kings.black.rank <= 1;
    const whiteOnBottom = kings.white.rank >= 6;
    const blackOnBottom = kings.black.rank >= 6;
    const whiteOnTop = kings.white.rank <= 1;
    if (blackOnTop && whiteOnBottom) return { grid, flipped: false, reason: 'kings' };
    if (whiteOnTop && blackOnBottom) return { grid: flip180(grid), flipped: true, reason: 'kings' };
    // Kings present but unusual placement — fall through to mass.
  }

  const massVerdict = colorMassVerdict(grid);
  if (massVerdict === 'normal') return { grid, flipped: false, reason: 'mass' };
  if (massVerdict === 'inverted') return { grid: flip180(grid), flipped: true, reason: 'mass' };

  return { grid, flipped: false, reason: 'unsure' };
}

/** Rotate the 8×8 grid by 180°. (a1 ↔ h8, etc.) */
export function flip180(grid: DetectedGrid): DetectedGrid {
  const out: DetectedGrid = [];
  for (let r = 0; r < 8; r++) {
    const row: (FenPiece | null)[] = [];
    for (let f = 0; f < 8; f++) {
      row.push(grid[7 - r][7 - f]);
    }
    out.push(row);
  }
  return out;
}

interface KingLocations {
  white?: { rank: number; file: number };
  black?: { rank: number; file: number };
}

function findKings(grid: DetectedGrid): KingLocations {
  const out: KingLocations = {};
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = grid[r][f];
      if (p === 'K' && !out.white) out.white = { rank: r, file: f };
      else if (p === 'k' && !out.black) out.black = { rank: r, file: f };
    }
  }
  return out;
}

/**
 * Count pieces by color in the top and bottom halves of the grid (top =
 * ranks 0–3, bottom = ranks 4–7).
 *
 * 'normal'   = top has more black pieces than white (white-at-bottom view)
 * 'inverted' = bottom has more black pieces than white (black-at-bottom view)
 * 'tie'      = neither side dominates; fall back to unsure.
 *
 * We require a margin (≥3) before deciding — a few stragglers from
 * misclassification shouldn't tip the vote.
 */
function colorMassVerdict(grid: DetectedGrid): 'normal' | 'inverted' | 'tie' {
  let topWhite = 0, topBlack = 0, botWhite = 0, botBlack = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = grid[r][f];
      if (!p) continue;
      const isWhite = p === p.toUpperCase();
      if (r < 4) {
        if (isWhite) topWhite++; else topBlack++;
      } else {
        if (isWhite) botWhite++; else botBlack++;
      }
    }
  }
  const normalMargin = (topBlack - topWhite) + (botWhite - botBlack);
  const invertedMargin = (topWhite - topBlack) + (botBlack - botWhite);
  if (normalMargin >= 3 && normalMargin > invertedMargin) return 'normal';
  if (invertedMargin >= 3 && invertedMargin > normalMargin) return 'inverted';
  return 'tie';
}
