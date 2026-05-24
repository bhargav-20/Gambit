import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Puzzle } from '@/features/puzzles/catalog';

export type PuzzleAttemptStatus = 'idle' | 'in_progress' | 'wrong' | 'solved' | 'revealed';

interface PuzzleState {
  active: Puzzle | null;
  expectedIndex: number;      // index into puzzle.solution we expect next
  status: PuzzleAttemptStatus;
  lastWrongMove: string | null;
  /** Set the first time the user makes a wrong move OR reveals the solution
   *  for the current puzzle session. Prevents double-counting attempts when
   *  the user fumbles multiple times before succeeding/giving up. */
  failedThisAttempt: boolean;
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
  /** Auto-clear the 'wrong' visual state back to 'in_progress' so the user
   *  can immediately try another move without an extra click. */
  clearWrong: () => void;
  /** Mark the puzzle as revealed (user gave up). Doesn't count as solved,
   *  breaks the streak. UI plays out the solution animation. */
  markRevealed: () => void;
}

export const usePuzzleStore = create<PuzzleState>()(
  persist(
    (set, get) => ({
      active: null,
      expectedIndex: 0,
      status: 'idle',
      lastWrongMove: null,
      failedThisAttempt: false,
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
          failedThisAttempt: false,
        }),

      exit: () =>
        set({
          active: null,
          expectedIndex: 0,
          status: 'idle',
          lastWrongMove: null,
          failedThisAttempt: false,
        }),

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
        const { active, expectedIndex, solvedIds, solvedCount, attemptedCount, streak, failedThisAttempt } = get();
        if (!active) return;
        // After a user move, expectedIndex was at user's move; advance 2 (user + opponent's reply).
        const next = expectedIndex + 2;
        if (next >= active.solution.length) {
          // Solved. Only credit it as "newly attempted" / "newly solved" if this
          // is the user's first time seeing it AND they didn't peek/fumble. The
          // streak still only bumps on a clean first-try solve.
          const newlySolved = !solvedIds.includes(active.id);
          const cleanSolve = !failedThisAttempt;
          set({
            status: 'solved',
            solvedCount: newlySolved && cleanSolve ? solvedCount + 1 : solvedCount,
            attemptedCount: newlySolved ? attemptedCount + 1 : attemptedCount,
            streak: cleanSolve ? streak + 1 : 0,
            solvedIds: newlySolved && cleanSolve ? [...solvedIds, active.id] : solvedIds,
          });
        } else {
          set({ expectedIndex: next, status: 'in_progress' });
        }
      },

      markWrong: (san) => {
        const { active, attemptedCount, failedThisAttempt } = get();
        if (!active) return;
        set({
          status: 'wrong',
          lastWrongMove: san,
          // Count one attempt per puzzle session, no matter how many wrong
          // moves the user tries. Same with breaking the streak — once is
          // enough.
          attemptedCount: failedThisAttempt ? attemptedCount : attemptedCount + 1,
          streak: 0,
          failedThisAttempt: true,
        });
      },

      clearWrong: () => {
        const { status } = get();
        if (status === 'wrong') set({ status: 'in_progress', lastWrongMove: null });
      },

      markRevealed: () => {
        const { active, attemptedCount, failedThisAttempt } = get();
        if (!active) return;
        set({
          status: 'revealed',
          attemptedCount: failedThisAttempt ? attemptedCount : attemptedCount + 1,
          streak: 0,
          failedThisAttempt: true,
        });
      },
    }),
    {
      name: 'shatran:puzzles',
      partialize: (s) => ({
        solvedCount: s.solvedCount,
        attemptedCount: s.attemptedCount,
        streak: s.streak,
        solvedIds: s.solvedIds,
      }),
    },
  ),
);
