/**
 * Four user-facing difficulty presets, each a (Stockfish Skill Level,
 * search-time cap, blurb) triple.
 *
 * Stockfish's `Skill Level` is a 0–20 knob that biases move selection
 * stochastically — at low levels the engine still searches deep but
 * sometimes picks a non-optimal move from a small candidate list. Pairing
 * it with a short `go movetime` ensures the very weak presets actually
 * blunder in tactical positions, not just in quiet ones.
 *
 * The ELO numbers are approximate and come from the Stockfish docs +
 * community testing. They depend on hardware (Stockfish 18 Lite WASM on
 * a typical laptop runs at maybe 1–2 MN/s, far below native speeds),
 * so treat them as a rough ladder rather than a guarantee.
 */
export type BotDifficultyId = 'novice' | 'beginner' | 'intermediate' | 'advanced' | 'max';

export interface BotDifficulty {
  id: BotDifficultyId;
  label: string;
  blurb: string;
  approxElo: string;
  skillLevel: number;
  movetimeMs: number;
  /**
   * Probability (0..1) of overriding the engine's move with a uniformly
   * random legal move. Used to push the very weakest preset below Stockfish's
   * intrinsic floor (Skill 0 is still ~1320 ELO — true beginner play needs
   * frequent blunders, not just suboptimal evaluation).
   */
  randomMoveRate?: number;
}

export const BOT_DIFFICULTIES: BotDifficulty[] = [
  {
    id: 'novice',
    label: 'Novice',
    blurb: 'Hangs pieces and misses checks. For your first games of chess.',
    approxElo: '~500',
    skillLevel: 0,
    movetimeMs: 50,
    randomMoveRate: 0.5,
  },
  {
    id: 'beginner',
    label: 'Beginner',
    blurb: 'Drops pieces, misses easy tactics. Good for learning.',
    approxElo: '~1400',
    skillLevel: 1,
    movetimeMs: 200,
  },
  {
    id: 'intermediate',
    label: 'Intermediate',
    blurb: 'Solid club player. Punishes loose moves, plays sound openings.',
    approxElo: '~1800',
    skillLevel: 8,
    movetimeMs: 500,
  },
  {
    id: 'advanced',
    label: 'Advanced',
    blurb: 'Strong. Expect deep tactics — bring your A-game.',
    approxElo: '~2200',
    skillLevel: 15,
    movetimeMs: 1500,
  },
  {
    id: 'max',
    label: 'Max',
    blurb: 'Stockfish at full strength. Few humans win against this.',
    approxElo: '2700+',
    skillLevel: 20,
    movetimeMs: 3000,
  },
];

export function findDifficulty(id: BotDifficultyId): BotDifficulty {
  return BOT_DIFFICULTIES.find((d) => d.id === id) ?? BOT_DIFFICULTIES[1];
}
