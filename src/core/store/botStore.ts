import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { BotDifficultyId } from '@/features/bot/difficulty';

export type BotColor = 'white' | 'black';
export type BotResult = 'white' | 'black' | 'draw';
export type BotEndReason =
  | 'checkmate'
  | 'resign'
  | 'stalemate'
  | 'insufficient'
  | 'repetition'
  | '50-move';

interface BotState {
  // ---- User preferences — persisted across sessions ----
  /** Last difficulty the user picked; defaults to intermediate so a fresh
   *  user gets a reasonable opponent without having to fiddle. */
  difficulty: BotDifficultyId;
  /** What the user chose to play; 'random' is resolved at game start. */
  preferredColor: BotColor | 'random';

  // ---- Active match — NOT persisted (a refresh ends the bot game). ----
  /** Null when no match is active. Set on startBot. */
  playerColor: BotColor | null;
  /** True while the bot is searching. UI shows a "Thinking…" indicator
   *  and the board's movable.color stays empty to lock player input. */
  thinking: boolean;
  result: BotResult | null;
  endReason: BotEndReason | null;

  // ---- Actions ----
  setDifficulty: (d: BotDifficultyId) => void;
  setPreferredColor: (c: BotColor | 'random') => void;
  /** Resolve the player's color (random → white|black), open a fresh
   *  match, and clear any previous result. */
  startMatch: (resolvedColor: BotColor) => void;
  setThinking: (v: boolean) => void;
  endMatch: (result: BotResult, reason: BotEndReason) => void;
  /** Reset back to lobby state. Keeps the persisted difficulty/color. */
  reset: () => void;
}

export const useBotStore = create<BotState>()(
  persist(
    (set) => ({
      difficulty: 'intermediate',
      preferredColor: 'white',
      playerColor: null,
      thinking: false,
      result: null,
      endReason: null,

      setDifficulty: (d) => set({ difficulty: d }),
      setPreferredColor: (c) => set({ preferredColor: c }),
      startMatch: (resolvedColor) => set({
        playerColor: resolvedColor,
        thinking: false,
        result: null,
        endReason: null,
      }),
      setThinking: (v) => set({ thinking: v }),
      endMatch: (result, reason) => set({ result, endReason: reason, thinking: false }),
      reset: () => set({ playerColor: null, thinking: false, result: null, endReason: null }),
    }),
    {
      name: 'gambit:bot',
      partialize: (s) => ({
        difficulty: s.difficulty,
        preferredColor: s.preferredColor,
      }),
    },
  ),
);
