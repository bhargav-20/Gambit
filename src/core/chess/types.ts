// Square notation: a1..h8
export type Square =
  | `${'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`;

export type Color = 'w' | 'b';

export interface MoveStep {
  san: string;         // Standard Algebraic Notation, e.g. "Nf3"
  uci: string;         // Long algebraic, e.g. "g1f3" (used by chessground for last-move highlight)
  from: Square;
  to: Square;
  fenAfter: string;    // FEN string after this move
  capture: boolean;
  check: boolean;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface GameMeta {
  id: string;
  title: string;
  white?: string;
  black?: string;
  event?: string;
  date?: string;
  eco?: string;          // ECO opening code
  description?: string;
  openingId?: string;    // catalog id when this game was loaded from a preset opening
  source: 'opening' | 'paste' | 'upload' | 'editor' | 'url';
}

export interface LoadedGame {
  meta: GameMeta;
  initialFen: string;
  moves: MoveStep[];
  rawPgn: string;
}
