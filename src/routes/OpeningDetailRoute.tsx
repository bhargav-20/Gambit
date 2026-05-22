import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import { OPENINGS } from '@/features/openings/catalog';
import { OpeningsPanel } from '@/features/openings/OpeningsPanel';
import { ActivityLayout } from '@/app/ActivityLayout';

/**
 * `/openings/:openingId` — board view of a specific opening. Looks up the
 * opening in the catalog, loads it via the existing `loadFromPgn`, then
 * defers all chrome to ActivityLayout. The right column shows the default
 * GamePanel (Moves / Idea / Browse).
 *
 * If the id is unknown we redirect to the catalog rather than show a 404.
 * That keeps the URL forgiving when sharing a stale link.
 */
export function OpeningDetailRoute() {
  const { openingId } = useParams<{ openingId: string }>();
  const opening = OPENINGS.find((o) => o.id === openingId);
  const loadFromPgn = useGameStore((s) => s.loadFromPgn);

  // Load the opening (only when the id actually changes — `loadFromPgn`
  // rebuilds the chess.js game internally, which we don't want to do on
  // every render). Also flip mode back to visualizer so anything left over
  // from puzzle/pvp/etc. is cleared.
  useEffect(() => {
    if (!opening) return;
    const currentId = useGameStore.getState().game.meta.openingId;
    if (currentId !== opening.id) {
      loadFromPgn(opening.pgn, {
        title: opening.name,
        description: opening.description,
        eco: opening.eco,
        openingId: opening.id,
        source: 'opening',
      });
    } else {
      const m = useGameStore.getState().mode;
      if (m !== 'visualizer') useGameStore.setState({ mode: 'visualizer', editMode: false });
    }
  }, [opening, loadFromPgn]);

  if (!openingId) return <Navigate to="/openings" replace />;
  if (!opening) return <Navigate to="/openings" replace />;

  return <ActivityLayout rightPanel={<OpeningsPanel />} />;
}
