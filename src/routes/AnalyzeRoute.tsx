import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import { ActivityLayout } from '@/app/ActivityLayout';
import { AnalyzePanel } from '@/features/analysis/AnalyzePanel';

/**
 * `/analyze` — the all-purpose study surface. Engine on, edit on, branching
 * with snapshot-and-restore. Replaces the old /compose route: pasting a PGN,
 * starting an empty board, or branching off an opening all land here.
 *
 * Entry modes are driven by `location.state`:
 *
 *   { startFromHere: true } — caller is "Branch from here." Truncate the
 *                              current line at the current ply, then snap
 *                              into analyze. Used by the Analyze-bar button.
 *
 *   (no state)              — default. If a game is loaded but we're not yet
 *                              in analyze mode, snapshot it and switch.
 */
export function AnalyzeRoute() {
  const location = useLocation();
  const analyzeGame = useGameStore((s) => s.analyzeGame);
  const composeFromHere = useGameStore((s) => s.composeFromHere);

  useEffect(() => {
    const intent = location.state as { startFromHere?: boolean } | null;
    if (intent?.startFromHere) {
      composeFromHere();
      // History.state lingers across the route's lifetime in React Router;
      // there's no harm in leaving it, since the truncation is idempotent
      // (running it again on an already-truncated game just re-truncates
      // at the same ply, which is a no-op).
      return;
    }
    const m = useGameStore.getState().mode;
    if (m !== 'analyze') analyzeGame();
  }, [analyzeGame, composeFromHere, location.state]);

  return <ActivityLayout rightPanel={<AnalyzePanel />} />;
}
