import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Puzzle } from '@/features/puzzles/catalog';

export type PuzzleAttemptStatus = 'idle' | 'in_progress' | 'wrong' | 'solved';

interface PuzzleState {
  active: Puzzle | null;
  expectedIndex: number;      // index into puzzle.solution we expect next
  status: PuzzleAttemptStatus;
  lastWrongMove: string | null;
  solvedCount: number;        // total across sessions
  attemptedCount: number;     // total across sessions
  streak: number;             // current solved-in-a-row
  solvedIds: string[];        // ids the user has ever solved

  start: (puzzle: Puzzle) => void;
  exit: () => void;
  /** Returns true if the SAN matches the next expected user move. */
  checkMove: (san: string) => 'correct' | 'wrong' | 'no_puzzle';
  advance: () => void;        // called after a correct move applied
  markWrong: (san: string) => void;
}

export const usePuzzleStore = create<PuzzleState>()(
  persist(
    (set, get) => ({
      active: null,
      expectedIndex: 0,
      status: 'idle',
      lastWrongMove: null,
      solvedCount: 0,
      attemptedCount: 0,
      streak: 0,
      solvedIds: [],

      start: (puzzle) =>
        set({
          active: puzzle,
          expectedIndex: 0,
          status: 'in_progress',
          lastWrongMove: null,
        }),

      exit: () => set({ active: null, expectedIndex: 0, status: 'idle', lastWrongMove: null }),

      checkMove: (san) => {
        const { active, expectedIndex } = get();
        if (!active) return 'no_puzzle';
        const expected = active.solution[expectedIndex];
        // Normalize: chess.js sometimes emits "Nxe4+" vs "Nxe4#" depending on promotion;
        // we compare after stripping trailing check/mate decoration.
        const norm = (s: string) => s.replace(/[+#?!]+$/, '');
        return norm(san) === norm(expected) ? 'correct' : 'wrong';
      },

      advance: () => {
        const { active, expectedIndex, solvedIds, solvedCount, attemptedCount, streak } = get();
        if (!active) return;
        // After a user move, expectedIndex was at user's move; advance 2 (user + opponent's reply).
        const next = expectedIndex + 2;
        if (next >= active.solution.length) {
          // Solved.
          const newlySolved = !solvedIds.includes(active.id);
          set({
            status: 'solved',
            solvedCount: newlySolved ? solvedCount + 1 : solvedCount,
            attemptedCount: newlySolved ? attemptedCount + 1 : attemptedCount,
            streak: streak + 1,
            solvedIds: newlySolved ? [...solvedIds, active.id] : solvedIds,
          });
        } else {
          set({ expectedIndex: next, status: 'in_progress' });
        }
      },

      markWrong: (san) => {
        const { active, attemptedCount } = get();
        if (!active) return;
        set({
          status: 'wrong',
          lastWrongMove: san,
          attemptedCount: attemptedCount + 1,
          streak: 0,
        });
      },
    }),
    {
      name: 'gambit:puzzles',
      partialize: (s) => ({
        solvedCount: s.solvedCount,
        attemptedCount: s.attemptedCount,
        streak: s.streak,
        solvedIds: s.solvedIds,
      }),
    },
  ),
);
