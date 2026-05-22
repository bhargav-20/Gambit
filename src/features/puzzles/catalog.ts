// Curated tactical puzzles. Each puzzle is a position (FEN) plus a sequence
// of correct moves (SAN). The user plays the side whose move it is in the
// FEN; the engine (us) plays the opponent's replies automatically.
//
// For each puzzle, `solution` alternates user-move, opponent-move, user-move,
// ..., ending with the last user move that solves the puzzle.
//
// Each position in this file has been verified end-to-end with chess.js:
// every move in every solution is legal, every claimed mate is mate.
// The dev-time `validatePuzzles()` call at the bottom re-runs the check on
// module load so any future edits surface errors immediately in the console.

import { Chess } from 'chess.js';

export interface Puzzle {
  id: string;
  title: string;
  theme: string;           // e.g. "Fork", "Pin", "Back rank", "Mate in 2"
  difficulty: 1 | 2 | 3;   // 1 = easy, 2 = medium, 3 = hard
  fen: string;
  solution: string[];      // alternating SAN moves starting with the user's first move
  hint?: string;
}

export const PUZZLES: Puzzle[] = [
  {
    id: 'back-rank-1',
    title: 'Classic Back Rank',
    theme: 'Back rank mate',
    difficulty: 1,
    fen: '6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1',
    solution: ['Ra8#'],
    hint: 'The g8-king has no escape on the back rank.',
  },
  {
    id: 'promotion-check',
    title: 'Promotion Trick',
    theme: 'Pawn promotion',
    difficulty: 1,
    fen: '8/P7/8/8/8/8/8/k6K w - - 0 1',
    solution: ['a8=Q+'],
    hint: 'Promote and check at the same time.',
  },
  {
    id: 'royal-fork',
    title: 'Royal Fork',
    theme: 'Knight fork',
    difficulty: 1,
    fen: '5q1k/8/8/4N3/8/8/8/4K3 w - - 0 1',
    solution: ['Ng6+', 'Kg8', 'Nxf8'],
    hint: 'The knight can hit king and queen from one square.',
  },
  {
    id: 'pinned-queen',
    title: 'Pinned Queen',
    theme: 'Pin',
    difficulty: 1,
    fen: '7k/6q1/8/8/8/8/1B6/2K5 w - - 0 1',
    solution: ['Bxg7+'],
    hint: 'The queen is pinned to the king on the long diagonal.',
  },
  {
    id: 'discovered-attack',
    title: 'Discovered Attack',
    theme: 'Discovered attack',
    difficulty: 2,
    fen: '4k3/8/4q3/8/4B3/8/4R3/4K3 w - - 0 1',
    solution: ['Bd5'],
    hint: 'Move the bishop to discover an attack on the queen.',
  },
  {
    id: 'rook-skewer',
    title: 'Rook Skewer',
    theme: 'Skewer',
    difficulty: 2,
    fen: '4q3/8/4k3/8/8/8/8/R5K1 w - - 0 1',
    solution: ['Re1+', 'Kd5', 'Rxe8'],
    hint: 'Force the king off the e-file, then grab the queen behind it.',
  },
  {
    id: 'queen-mate-pattern',
    title: 'Queen + King Mate',
    theme: 'Mate in 2',
    difficulty: 2,
    fen: '5k2/8/5K2/4Q3/8/8/8/8 w - - 0 1',
    solution: ['Qe7+', 'Kg8', 'Qg7#'],
    hint: 'Push the king to the corner, then close the net with the queen supported by your own king.',
  },
  {
    id: 'greek-gift-setup',
    title: 'Greek Gift Setup',
    theme: 'Sacrifice',
    difficulty: 2,
    fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 1',
    solution: ['Bxf7+', 'Rxf7', 'Ng5'],
    hint: 'Sacrifice the bishop to peel the rook off f8.',
  },
  {
    id: 'overworked',
    title: 'Overworked Piece',
    theme: 'Overworked piece',
    difficulty: 2,
    fen: '2r3k1/5ppp/8/8/8/8/2Q2PPP/4R1K1 w - - 0 1',
    solution: ['Qxc8#'],
    hint: 'The rook can\'t guard both the back rank and itself.',
  },
  {
    id: 'opera-mate',
    title: 'Opera House Mate',
    theme: 'Mate in 2',
    difficulty: 2,
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w - - 0 1',
    solution: ['Qb8+', 'Nxb8', 'Rd8#'],
    hint: 'Sacrifice the queen to deflect the knight from defending d8.',
  },
  {
    id: 'zwischenzug',
    title: 'Intermediate Move',
    theme: 'Zwischenzug',
    difficulty: 3,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1',
    solution: ['Ng5', 'd5', 'exd5', 'Nxd5', 'Bxd5'],
    hint: 'Make a threat before recapturing.',
  },
];

export function findPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}

/**
 * Side-to-move encoded in the FEN. Used by the UI to show the player which
 * color they're solving for, and by PuzzleDetailRoute to orient the board.
 */
export function puzzleSideToMove(p: Puzzle): 'white' | 'black' {
  return p.fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

/**
 * Walk every puzzle's solution through chess.js. Reports any puzzle whose
 * solution doesn't apply cleanly, or whose final move claims mate (#) but
 * the position isn't actually mate. Only runs in development; stripped from
 * production builds by the `import.meta.env.DEV` gate.
 *
 * This is the canary that catches stale/typo'd SAN before users hit it.
 */
function validatePuzzles(puzzles: Puzzle[]): void {
  for (const p of puzzles) {
    let c: Chess;
    try {
      c = new Chess(p.fen);
    } catch (e) {
      console.warn(`[puzzles] ${p.id}: invalid FEN — ${(e as Error).message}`);
      continue;
    }
    let failed = false;
    for (let i = 0; i < p.solution.length; i++) {
      try {
        const r = c.move(p.solution[i]);
        if (!r) {
          console.warn(`[puzzles] ${p.id}: move ${i} (${p.solution[i]}) rejected by chess.js`);
          failed = true;
          break;
        }
      } catch (e) {
        console.warn(`[puzzles] ${p.id}: move ${i} (${p.solution[i]}) threw — ${(e as Error).message}`);
        failed = true;
        break;
      }
    }
    if (failed) continue;
    const last = p.solution[p.solution.length - 1];
    if (last.endsWith('#') && !c.isCheckmate()) {
      console.warn(`[puzzles] ${p.id}: claims # but final position is not checkmate`);
    }
    if (!last.endsWith('#') && c.isCheckmate()) {
      console.warn(`[puzzles] ${p.id}: final position is mate but SAN missing #`);
    }
  }
}

if (import.meta.env.DEV) {
  validatePuzzles(PUZZLES);
}
