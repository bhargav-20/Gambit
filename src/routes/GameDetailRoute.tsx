import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import { findGame } from '@/features/games/catalog';
import { GameStoryPanel } from '@/features/games/GameStoryPanel';
import { ActivityLayout } from '@/app/ActivityLayout';

/**
 * `/games/:gameId` — board view of a specific famous game. Loads the PGN
 * with `source: 'famous-game'` and the catalog id attached to meta, so
 * GameStoryPanel can look up the narrative + key moments.
 *
 * Unknown ids redirect to /games so stale shared links forgive gracefully.
 */
export function GameDetailRoute() {
  const { gameId } = useParams<{ gameId: string }>();
  const game = gameId ? findGame(gameId) : undefined;
  const loadFromPgn = useGameStore((s) => s.loadFromPgn);

  useEffect(() => {
    if (!game) return;
    const currentId = useGameStore.getState().game.meta.gameId;
    if (currentId !== game.id) {
      loadFromPgn(game.pgn, {
        title: game.title,
        description: `${game.players.white} vs ${game.players.black}${game.date ? ' · ' + game.date.slice(0, 4) : ''}`,
        gameId: game.id,
        source: 'famous-game',
      });
    } else {
      const m = useGameStore.getState().mode;
      if (m !== 'visualizer') useGameStore.setState({ mode: 'visualizer', editMode: false });
    }
  }, [game, loadFromPgn]);

  if (!gameId) return <Navigate to="/games" replace />;
  if (!game) return <Navigate to="/games" replace />;

  return <ActivityLayout rightPanel={<GameStoryPanel />} />;
}
