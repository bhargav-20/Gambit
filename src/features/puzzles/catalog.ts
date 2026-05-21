// Curated tactical puzzles. Each puzzle is a position (FEN) plus a sequence
// of correct moves (SAN). The user plays the side whose move it is in the
// FEN; the engine (us) plays the opponent's replies automatically.
//
// For each puzzle, `solution` alternates user-move, opponent-move, user-move,
// ..., ending with the last user move that solves the puzzle.

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
    id: 'fork-knight-1',
    title: 'Royal Fork',
    theme: 'Knight fork',
    difficulty: 1,
    fen: '4k3/8/4N3/8/8/8/4K3/3Q4 w - - 0 1',
    solution: ['Nc7+'],
    hint: 'The knight can attack king and queen at the same time.',
  },
  {
    id: 'pin-1',
    title: 'Bishop Pin',
    theme: 'Pin',
    difficulty: 1,
    fen: '4k3/8/4q3/8/8/4B3/8/4K3 w - - 0 1',
    solution: ['Bb6'],
    hint: 'The queen is on the same file as the king.',
  },
  {
    id: 'skewer-1',
    title: 'Royal Skewer',
    theme: 'Skewer',
    difficulty: 1,
    fen: '4k3/8/4q3/8/8/8/8/R3K3 w Q - 0 1',
    solution: ['Re1+', 'Qe6', 'Rxe6+'],
    hint: 'Force the king to move, then capture the queen.',
  },
  {
    id: 'mate-2-1',
    title: 'Anastasia\'s Mate',
    theme: 'Mate in 2',
    difficulty: 2,
    fen: '6rk/5Npp/8/8/8/8/8/4R2K w - - 0 1',
    solution: ['Re8', 'Rxe8', 'Nxg7#'],
    hint: 'Deflect the rook, then mate with the knight + g7 pawn vacancy.',
  },
  {
    id: 'smothered-1',
    title: 'Smothered Mate Setup',
    theme: 'Smothered mate',
    difficulty: 2,
    fen: '6rk/6pp/8/8/8/8/8/4Q1NK w - - 0 1',
    solution: ['Qe5+', 'Rg7', 'Qxg7#'],
    hint: 'Force the rook to block, then deliver mate on g7.',
  },
  {
    id: 'discovered-1',
    title: 'Discovered Attack',
    theme: 'Discovered attack',
    difficulty: 2,
    fen: '4k3/8/4q3/8/4B3/8/4R3/4K3 w - - 0 1',
    solution: ['Bd5'],
    hint: 'Move the bishop to discover an attack on the queen.',
  },
  {
    id: 'deflection-1',
    title: 'Greek Gift Setup',
    theme: 'Deflection',
    difficulty: 2,
    fen: 'r1bq1rk1/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 1',
    solution: ['Bxf7+', 'Rxf7', 'Ng5'],
    hint: 'Sacrifice the bishop to deflect the rook.',
  },
  {
    id: 'queen-trap-1',
    title: 'Queen in the Corner',
    theme: 'Queen trap',
    difficulty: 2,
    fen: '4k3/8/8/8/8/q7/8/R3K3 w Q - 0 1',
    solution: ['Ra2', 'Qb3', 'Rb2'],
    hint: 'Cut off the queen\'s escape squares.',
  },
  {
    id: 'mate-3-1',
    title: 'King Hunt',
    theme: 'Mate in 3',
    difficulty: 3,
    fen: '6k1/5ppp/8/8/8/3Q4/5PPP/6K1 w - - 0 1',
    solution: ['Qd8+', 'Kh7', 'Qxf8'],
    hint: 'Drive the king and convert.',
  },
  {
    id: 'zwischenzug-1',
    title: 'Intermediate Move',
    theme: 'Zwischenzug',
    difficulty: 3,
    fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 0 1',
    solution: ['Ng5', 'd5', 'exd5', 'Nxd5', 'Bxd5'],
    hint: 'Make a threat before recapturing.',
  },
  {
    id: 'opera-mate',
    title: 'Opera House Mate Pattern',
    theme: 'Mate in 2',
    difficulty: 2,
    fen: '4kb1r/p2n1ppp/4q3/4p1B1/4P3/1Q6/PPP2PPP/2KR4 w - - 0 1',
    solution: ['Qb8+', 'Nxb8', 'Rd8#'],
    hint: 'Sacrifice the queen to deflect the knight from defending d8.',
  },
  {
    id: 'pawn-promotion-1',
    title: 'Promotion Trick',
    theme: 'Pawn promotion',
    difficulty: 1,
    fen: '8/P7/8/8/8/8/8/k6K w - - 0 1',
    solution: ['a8=Q+'],
    hint: 'Promote and check at the same time.',
  },
  {
    id: 'overworked-1',
    title: 'Overworked Piece',
    theme: 'Overworked piece',
    difficulty: 2,
    fen: '2r3k1/5ppp/8/8/8/8/2Q2PPP/4R1K1 w - - 0 1',
    solution: ['Qxc8+'],
    hint: 'The rook can\'t defend both pieces.',
  },
  {
    id: 'double-attack-1',
    title: 'Double Attack',
    theme: 'Double attack',
    difficulty: 1,
    fen: '4k3/8/2q5/8/8/8/2N5/4K3 w - - 0 1',
    solution: ['Ne3'],
    hint: 'The knight forks queen and king on diagonal moves.',
  },
];

export function findPuzzle(id: string): Puzzle | undefined {
  return PUZZLES.find((p) => p.id === id);
}
