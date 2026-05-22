import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { usePvpStore } from '@/core/store/pvpStore';
import { Board2D } from '@/features/board2d/Board2D';
import { Board3DStub } from '@/features/board3d/Board3DStub';
import { PlaybackControls } from '@/features/playback/PlaybackControls';
import { GamePanel } from '@/features/playback/GamePanel';
import { MoveNote } from '@/features/playback/MoveNote';
import { AnalysisBar } from '@/features/analysis/AnalysisBar';
import { EvalBar } from '@/features/analysis/EvalBar';
import { PlayerStrip } from '@/features/pvp/PlayerStrip';
import { MobileActions } from './MobileActions';
import { MobileDrawers } from './MobileDrawers';

interface Props {
  /** Replaces the right column's default GamePanel. Use when a route owns its
   *  own right-column content (e.g. Play uses PvpMatchPanel, an active puzzle
   *  uses ActivePuzzle). When omitted, GamePanel renders with Moves/Idea/Browse
   *  tabs. */
  rightColumn?: React.ReactNode;
  /** Hide the visualizer's playback controls + MoveNote (PvP uses its own
   *  match controls instead). */
  hidePlayback?: boolean;
}

/**
 * The board-centered layout shared by every "doing chess" route. Centralizes
 * the board placement, eval bar overlay, player strips (PvP only), playback
 * controls, and the right-side panel column so each route doesn't reinvent
 * it.
 *
 * Routes pass route-specific content via `rightColumn`; everything else
 * (board, evals, mobile drawers) renders identically across activities.
 */
export function ActivityLayout({ rightColumn, hidePlayback }: Props) {
  const renderMode = useUiStore((s) => s.renderMode);
  const mode = useGameStore((s) => s.mode);
  const pvpLocalColor = usePvpStore((s) => s.localColor);

  const showStrips = mode === 'pvp' && !!pvpLocalColor;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 p-3 sm:p-4 lg:p-6 max-w-[1700px] mx-auto w-full">
      <div className="flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4">
        {/* Board column */}
        <div className="flex items-center justify-center lg:flex-1 lg:min-h-0">
          <div
            className="w-full flex flex-col gap-2"
            style={{ maxWidth: 'min(100%, max(320px, min(80vh, calc(100vh - 220px))))' }}
          >
            {showStrips && <PlayerStrip side="opponent" />}
            <div className="relative aspect-square w-full">
              <EvalBar />
              {renderMode === '2d' ? <Board2D /> : <Board3DStub />}
            </div>
            {showStrips && <PlayerStrip side="self" />}
          </div>
        </div>

        {/* Right column */}
        <div className="lg:w-80 lg:min-h-0 flex flex-col gap-3">
          {!hidePlayback && (
            <>
              <PlaybackControls />
              <AnalysisBar />
              <MoveNote />
            </>
          )}
          <MobileActions />
          <div className="hidden lg:flex flex-col flex-1 min-h-0">
            {rightColumn ?? <GamePanel />}
          </div>
        </div>
      </div>
      <MobileDrawers />
    </div>
  );
}
