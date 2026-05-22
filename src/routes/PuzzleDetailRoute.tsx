import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import { usePuzzleStore } from '@/core/store/puzzleStore';
import { PUZZLES } from '@/features/puzzles/catalog';
import { loadEmpty } from '@/core/chess/pgn';
import { PuzzlePanel } from '@/features/puzzles/PuzzlePanel';
import { ActivityLayout } from '@/app/ActivityLayout';

/**
 * `/puzzles/:puzzleId` — board view for a specific puzzle. Loads the FEN
 * into gameStore, starts puzzle mode, and lets PuzzlePanel handle the
 * active-puzzle UI (hint, status, retry, etc.) in the right column.
 */
export function PuzzleDetailRoute() {
  const { puzzleId } = useParams<{ puzzleId: string }>();
  const puzzle = PUZZLES.find((p) => p.id === puzzleId);
  const loadGame = useGameStore((s) => s.loadGame);
  const startPuzzle = useGameStore((s) => s.startPuzzle);
  const start = usePuzzleStore((s) => s.start);

  // Spin the puzzle up on mount. Guarded so we don't restart on every render
  // — only when the id changes or no puzzle is currently active.
  useEffect(() => {
    if (!puzzle) return;
    const active = usePuzzleStore.getState().active;
    if (active?.id === puzzle.id) return;
    const game = loadEmpty(puzzle.fen, { title: puzzle.title, source: 'editor' });
    loadGame(game);
    startPuzzle();
    start(puzzle);
  }, [puzzle, loadGame, startPuzzle, start]);

  if (!puzzleId) return <Navigate to="/puzzles" replace />;
  if (!puzzle) return <Navigate to="/puzzles" replace />;

  return <ActivityLayout rightColumn={<PuzzlePanel />} hidePlayback />;
}
