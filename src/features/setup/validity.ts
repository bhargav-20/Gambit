import { Chess } from 'chess.js';
import type { Square } from '@/core/chess/types';
import type { FenPiece, CastlingRights } from '@/core/store/setupStore';

/**
 * Validity rules for a setup-mode position. Returns either ok or a list of
 * blocking errors plus a list of soft warnings. Errors gate the "Analyze
 * this position →" CTA; warnings just surface a note.
 */
export interface ValiditySummary {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export interface ValidityInput {
  squares: Partial<Record<Square, FenPiece>>;
  sideToMove: 'w' | 'b';
  castling: CastlingRights;
  enPassant: Square | null;
  fen: string;
}

function countPieces(squares: Partial<Record<Square, FenPiece>>) {
  const counts: Record<string, number> = {};
  for (const p of Object.values(squares)) {
    if (!p) continue;
    counts[p] = (counts[p] || 0) + 1;
  }
  return counts;
}

function pieceAt(squares: Partial<Record<Square, FenPiece>>, sq: Square): FenPiece | undefined {
  return squares[sq];
}

export function checkValidity(input: ValidityInput): ValiditySummary {
  const errors: string[] = [];
  const warnings: string[] = [];
  const counts = countPieces(input.squares);

  // Exactly one king per side.
  if ((counts['K'] || 0) !== 1) errors.push('Need exactly one white king.');
  if ((counts['k'] || 0) !== 1) errors.push('Need exactly one black king.');

  // Pawns can't sit on rank 1 or 8.
  for (const [sq, p] of Object.entries(input.squares)) {
    if (!p) continue;
    if ((p === 'P' || p === 'p') && (sq.endsWith('1') || sq.endsWith('8'))) {
      errors.push(`A pawn on ${sq} would already have promoted.`);
    }
  }

  // Reasonable upper bounds — these are soft warnings, not blockers, because
  // a setup tool needs to allow promoted-piece positions (e.g. two queens).
  if ((counts['P'] || 0) > 8) warnings.push('More than 8 white pawns.');
  if ((counts['p'] || 0) > 8) warnings.push('More than 8 black pawns.');

  // Castling rights consistent with king/rook positions.
  if (input.castling.K) {
    if (pieceAt(input.squares, 'e1') !== 'K' || pieceAt(input.squares, 'h1') !== 'R') {
      errors.push('White O-O castling needs king on e1 and rook on h1.');
    }
  }
  if (input.castling.Q) {
    if (pieceAt(input.squares, 'e1') !== 'K' || pieceAt(input.squares, 'a1') !== 'R') {
      errors.push('White O-O-O castling needs king on e1 and rook on a1.');
    }
  }
  if (input.castling.k) {
    if (pieceAt(input.squares, 'e8') !== 'k' || pieceAt(input.squares, 'h8') !== 'r') {
      errors.push('Black O-O castling needs king on e8 and rook on h8.');
    }
  }
  if (input.castling.q) {
    if (pieceAt(input.squares, 'e8') !== 'k' || pieceAt(input.squares, 'a8') !== 'r') {
      errors.push('Black O-O-O castling needs king on e8 and rook on a8.');
    }
  }

  // En-passant target must sit on rank 3 (if it's white-to-move capturing
  // an enemy pawn just-pushed to rank 5) or rank 6 (mirror). The pawn must
  // actually be there.
  if (input.enPassant) {
    const ep = input.enPassant;
    if (input.sideToMove === 'w') {
      if (!ep.endsWith('6') || pieceAt(input.squares, `${ep[0]}5` as Square) !== 'p') {
        errors.push(`En-passant target ${ep} requires a black pawn on ${ep[0]}5.`);
      }
    } else {
      if (!ep.endsWith('3') || pieceAt(input.squares, `${ep[0]}4` as Square) !== 'P') {
        errors.push(`En-passant target ${ep} requires a white pawn on ${ep[0]}4.`);
      }
    }
  }

  // Final gate: chess.js's own validator. We pass the assembled FEN and
  // ask it whether the position would load — this catches a few exotic
  // illegalities our hand-rolled checks miss (e.g. the side not to move
  // being in check, which would mean the previous move was illegal).
  if (errors.length === 0) {
    try {
      const c = new Chess();
      c.load(input.fen);
      // chess.js doesn't catch "side not to move is in check" by default —
      // verify by flipping sides and asking inCheck.
      const flippedFen = input.fen.replace(
        / [wb] /,
        ` ${input.sideToMove === 'w' ? 'b' : 'w'} `,
      );
      const probe = new Chess();
      probe.load(flippedFen);
      if (probe.inCheck()) {
        errors.push('The side not to move is in check — that position is unreachable.');
      }
    } catch (e) {
      errors.push(`Position is invalid: ${(e as Error).message}`);
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
