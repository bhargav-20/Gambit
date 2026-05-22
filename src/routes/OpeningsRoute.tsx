import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { OpeningsPanel } from '@/features/openings/OpeningsPanel';

/**
 * `/openings` — the catalog landing page. Browse all 100+ openings in a
 * single-column list. Picking one navigates to `/openings/:id` where the
 * board view takes over. Resets the game mode to visualizer so any leftover
 * PvP/puzzle UI clears out.
 */
export function OpeningsRoute() {
  // The catalog view doesn't show a board, but we still want a sane game
  // mode if the user navigates away to compose/analyze. Reset to visualizer
  // on entry so stale composer/analyze toolbars don't follow them around.
  useEffect(() => {
    const cur = useGameStore.getState().mode;
    if (cur === 'puzzle' || cur === 'pvp') {
      useGameStore.setState({ mode: 'visualizer', editMode: false });
    }
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 flex-1 min-h-0 flex flex-col gap-4">
      <OpeningsPanel />
    </div>
  );
}
