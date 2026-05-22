import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { ActivityLayout } from '@/app/ActivityLayout';
import { AnalyzePanel } from '@/features/analysis/AnalyzePanel';

/**
 * `/analyze` — flips the currently-loaded game into analyze mode (snapshots
 * the line, enables branching, runs Stockfish). If no game is loaded the
 * board sits empty; the user can compose from here just by playing moves.
 *
 * Doesn't have its own right-column panel — the default GamePanel
 * (Moves / Idea / Browse) is plenty. The AnalysisBar above the right
 * column lights up automatically because mode='analyze'.
 */
export function AnalyzeRoute() {
  const analyzeGame = useGameStore((s) => s.analyzeGame);

  useEffect(() => {
    const m = useGameStore.getState().mode;
    if (m !== 'analyze') analyzeGame();
  }, [analyzeGame]);

  return <ActivityLayout rightPanel={<AnalyzePanel />} />;
}
