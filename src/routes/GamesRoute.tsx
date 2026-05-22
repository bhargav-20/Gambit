import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { GamesCatalog } from '@/features/games/GamesCatalog';

/**
 * `/games` — full-page catalog of famous games. Mirrors OpeningsRoute and
 * PuzzlesRoute. Picking a game navigates to /games/:gameId.
 */
export function GamesRoute() {
  // Reset edit / puzzle / pvp leftovers on entry — the catalog page
  // doesn't show a board but its child routes will, so leave the mode in
  // a known-good state.
  useEffect(() => {
    const cur = useGameStore.getState().mode;
    if (cur === 'puzzle' || cur === 'pvp') {
      useGameStore.setState({ mode: 'visualizer', editMode: false });
    }
  }, []);

  return (
    <div className="w-full max-w-3xl mx-auto p-4 sm:p-6 flex-1 min-h-0 flex flex-col gap-4">
      <GamesCatalog />
    </div>
  );
}
