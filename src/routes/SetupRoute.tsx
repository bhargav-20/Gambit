import { useEffect } from 'react';
import { useSetupStore } from '@/core/store/setupStore';
import { ActivityLayout } from '@/app/ActivityLayout';
import { SetupPanel } from '@/features/setup/SetupPanel';
import { PieceTray } from '@/features/setup/PieceTray';

/**
 * `/setup` — interactive position editor. Board accepts free-edit (no
 * legality enforcement), a piece tray lets the user "arm" a piece and tap
 * a square to place it, the eraser tool clears squares, dragging a piece
 * off the board removes it. The right panel owns side-to-move, castling
 * rights, en-passant, clocks, FEN paste/copy, validity feedback, and the
 * "Analyze this position →" CTA which loads the assembled FEN into the
 * main game and navigates to /analyze.
 *
 * Mode-flipping (gameStore.mode → 'setup' and back) is handled centrally
 * in AppShell's location-change effect so it doesn't depend on this
 * route's mount/unmount fire order — soft hash navigations don't always
 * re-fire mount effects under React Router.
 */
export function SetupRoute() {
  useEffect(() => {
    // Disarm the tray on entry so a piece "stuck on the cursor" from a
    // previous session doesn't surprise the user; they explicitly pick
    // one when they're ready.
    useSetupStore.getState().setArmed(null);
  }, []);

  return (
    <ActivityLayout
      rightPanel={<SetupPanel />}
      hidePlayback
      hideGamePanel
      belowBoard={<PieceTray />}
    />
  );
}
