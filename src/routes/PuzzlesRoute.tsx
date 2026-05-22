import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { PuzzlePanel } from '@/features/puzzles/PuzzlePanel';
import { usePuzzleStore } from '@/core/store/puzzleStore';

/**
 * `/puzzles` — catalog landing. Lists all puzzles with filter chips and the
 * solved/attempted/streak stats. Picking a puzzle calls PuzzlePanel's
 * existing launch path, which sets puzzle mode and FEN.
 *
 * On entry: clear any active puzzle so the user lands on the list, not the
 * last-active puzzle. This is the catalog page — they came here to browse.
 */
export function PuzzlesRoute() {
  const exit = usePuzzleStore((s) => s.exit);
  const endPuzzle = useGameStore((s) => s.endPuzzle);

  useEffect(() => {
    // If a puzzle is mid-solve, leaving it via the route is the user saying
    // "I'm going back to browse". Exit cleanly so the list shows.
    if (usePuzzleStore.getState().active) {
      exit();
      endPuzzle();
    }
  }, [exit, endPuzzle]);

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 flex-1 min-h-0 flex flex-col gap-4">
      <PuzzlePanel />
    </div>
  );
}
