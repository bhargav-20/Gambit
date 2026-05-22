import { Routes, Route } from 'react-router-dom';
import { useAnalysis } from '@/features/analysis/useAnalysis';
import { usePlayback, useKeyboardShortcuts } from '@/features/playback/usePlayback';
import { AppShell } from './app/AppShell';
import { Home } from './routes/Home';
import { OpeningsRoute } from './routes/OpeningsRoute';
import { OpeningDetailRoute } from './routes/OpeningDetailRoute';
import { PuzzlesRoute } from './routes/PuzzlesRoute';
import { PuzzleDetailRoute } from './routes/PuzzleDetailRoute';
import { PlayRoute } from './routes/PlayRoute';
import { AnalyzeRoute } from './routes/AnalyzeRoute';
import { GamesRoute } from './routes/GamesRoute';
import { NotFound } from './routes/NotFound';

/**
 * Top-level router. AppShell renders the persistent chrome (top bar,
 * sidebar, overlays) and the matched route in <Outlet />.
 *
 * Global subscriptions that need to live across routes — playback rAF
 * loop, keyboard shortcuts, Stockfish analysis hook — are wired here
 * so they survive route changes without re-mounting.
 */
export default function App() {
  usePlayback();
  useKeyboardShortcuts(true);
  useAnalysis();

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Home />} />
        <Route path="openings" element={<OpeningsRoute />} />
        <Route path="openings/:openingId" element={<OpeningDetailRoute />} />
        <Route path="puzzles" element={<PuzzlesRoute />} />
        <Route path="puzzles/:puzzleId" element={<PuzzleDetailRoute />} />
        <Route path="play" element={<PlayRoute />} />
        {/* /compose retired — its import features live in the TopBar Import
            modal, and free-play is now inside /analyze. The path stays in
            this comment so a future re-add doesn't trip on the gap. */}
        <Route path="analyze" element={<AnalyzeRoute />} />
        <Route path="games" element={<GamesRoute />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
