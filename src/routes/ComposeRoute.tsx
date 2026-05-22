import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { ImportPanel } from '@/features/import/ImportPanel';
import { ActivityLayout } from '@/app/ActivityLayout';

/**
 * `/compose` — paste a PGN, import from URL, or start a fresh composition.
 * The right column hosts the existing ImportPanel; the board mirrors
 * whatever is currently loaded so the user can see the result of their
 * action live.
 */
export function ComposeRoute() {
  // On entry: if we're sitting on a puzzle or PvP game, exit those modes
  // first — the user clearly wants to step out and edit/import.
  useEffect(() => {
    const m = useGameStore.getState().mode;
    if (m === 'puzzle' || m === 'pvp') {
      useGameStore.setState({ mode: 'visualizer', editMode: false });
    }
  }, []);

  return <ActivityLayout rightPanel={<ImportPanel />} />;
}
