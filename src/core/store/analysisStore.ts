import { create } from 'zustand';
import type { EvalSnapshot } from '@/features/analysis/engine';
import { getEngine } from '@/features/analysis/engine';

interface AnalysisState {
  /** Current eval for the active ply. */
  snapshot: EvalSnapshot | null;
  /** True while an evaluation is in flight. */
  busy: boolean;
  /** True if the engine has reported a hard error (e.g. failed to load). */
  failed: boolean;
  /** Depth to search to. Higher = stronger but slower. */
  depth: number;

  setDepth: (d: number) => void;
  /** Begin evaluating the given FEN. Stale evaluations are auto-cancelled. */
  analyze: (fen: string) => Promise<void>;
  /** Clear the current snapshot (e.g. when analysis toggles off). */
  clear: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set, get) => ({
  snapshot: null,
  busy: false,
  failed: false,
  depth: 14,

  setDepth: (d) => set({ depth: Math.max(6, Math.min(22, d)) }),

  analyze: async (fen) => {
    set({ busy: true, failed: false });
    try {
      const snap = await getEngine().evaluate(fen, get().depth, (interim) => {
        // Stream interim depths so the UI updates smoothly.
        set({ snapshot: interim });
      });
      set({ snapshot: snap, busy: false });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('Analysis failed:', e);
      set({ busy: false, failed: true });
    }
  },

  clear: () => set({ snapshot: null, busy: false }),
}));
