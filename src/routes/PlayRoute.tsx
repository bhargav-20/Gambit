import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { usePvpStore } from '@/core/store/pvpStore';
import { closeCurrent } from '@/features/pvp/session';
import { PvpLobby } from '@/features/pvp/PvpLobby';
import { PvpMatchPanel } from '@/features/pvp/PvpMatchPanel';
import { ActivityLayout } from '@/app/ActivityLayout';

/**
 * `/play` — PvP. Splits into two surfaces:
 *
 *   - Pre-handshake (lobby): no board, no clocks. Full-width lobby card.
 *   - Connected: board + PvpMatchPanel (clocks, resign/draw, end card).
 *
 * Cleans up the WebRTC session when the user leaves the route. PvP state is
 * intentionally lost on route change — there's no "background match"
 * concept, and leaving the page mid-game is morally the same as quitting.
 */
export function PlayRoute() {
  const channelStatus = usePvpStore((s) => s.channelStatus);
  const localColor = usePvpStore((s) => s.localColor);
  const result = usePvpStore((s) => s.result);

  useEffect(() => {
    return () => {
      // Route exit — tear down the WebRTC channel and reset session state.
      // Preserve persisted user preferences (name, time control).
      closeCurrent();
      const pvp = usePvpStore.getState();
      if (pvp.channelStatus !== 'idle') pvp.reset();
      const m = useGameStore.getState().mode;
      if (m === 'pvp') useGameStore.setState({ mode: 'visualizer', editMode: false });
    };
  }, []);

  const showBoard = (channelStatus === 'connected' || result !== null) && !!localColor;

  if (!showBoard) {
    return (
      <div className="w-full max-w-md mx-auto p-4 sm:p-6 flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
        <PvpLobby />
      </div>
    );
  }

  return <ActivityLayout rightPanel={<PvpMatchPanel />} hidePlayback />;
}
