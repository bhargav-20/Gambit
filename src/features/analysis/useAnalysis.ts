import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { useAnalysisStore } from '@/core/store/analysisStore';

/**
 * Re-runs Stockfish on whatever FEN the user has scrubbed to — but ONLY when
 * the user is in the Analysis sandbox. Outside that mode the engine stays
 * cold so visualizing a game or recording a composition doesn't eat CPU.
 * Debounced so racing through moves with the arrow keys doesn't spam it.
 */
export function useAnalysis() {
  const mode = useGameStore((s) => s.mode);
  const ply = useGameStore((s) => s.ply);
  const game = useGameStore((s) => s.game);
  const analyze = useAnalysisStore((s) => s.analyze);
  const clear = useAnalysisStore((s) => s.clear);

  useEffect(() => {
    // Engine runs in modes where the user is actively exploring positions:
    // composer (free play) and analyze (studying a loaded game). Visualizer
    // is pure replay and puzzle mode has its own (engine-free) flow.
    if (mode !== 'composer' && mode !== 'analyze') {
      clear();
      return;
    }
    const fen = useGameStore.getState().currentFen();
    const handle = window.setTimeout(() => {
      void analyze(fen);
    }, 220);
    return () => window.clearTimeout(handle);
  }, [mode, ply, game, analyze, clear]);
}
