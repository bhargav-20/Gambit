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
import clsx from 'clsx';

interface Props {
  /** Optional dedicated right column on desktop (lg+). Hosts the route's
   *  primary surface: catalog for openings/puzzles, import for compose,
   *  engine controls for analyze, match controls for pvp. On mobile this
   *  content surfaces via a bottom-sheet — see MobileDrawers + MobileActions. */
  rightPanel?: React.ReactNode;
  /** Hide playback controls + MoveNote for live modes (PvP) that don't use them. */
  hidePlayback?: boolean;
  /** Optional content rendered directly under the board in the board column.
   *  Used by /setup for the piece tray — needs to be reachable on mobile
   *  without diving through a drawer, since picking a piece is the primary
   *  verb of that view. */
  belowBoard?: React.ReactNode;
  /** Hide the Moves/Idea tab strip. Used by /setup where the previously-
   *  loaded game's moves are stale context and would mislead the user. */
  hideGamePanel?: boolean;
}

/**
 * The board-centered layout shared by every "doing chess" route.
 *
 * Desktop (lg+) is a 3-section main area:
 *
 *   1. Board column           — fluid; board + player strips (PvP) +
 *                               eval bar overlay.
 *   2. Info column (~320 px)  — playback controls, analysis status,
 *                               move-note, Moves/Idea tabs.
 *   3. Route panel (~340 px)  — passed in by the route. Hidden when
 *                               the route doesn't provide one.
 *
 * Mobile collapses all three into a single scrollable column with the
 * route panel reachable via a bottom-sheet button (MobileActions).
 */
export function ActivityLayout({ rightPanel, hidePlayback, belowBoard, hideGamePanel }: Props) {
  const renderMode = useUiStore((s) => s.renderMode);
  const mode = useGameStore((s) => s.mode);
  const pvpLocalColor = usePvpStore((s) => s.localColor);

  const showStrips = mode === 'pvp' && !!pvpLocalColor;
  // If the info column has nothing to show (no playback strip AND no game
  // panel), don't render it at all — empty 320 px gap between the board and
  // the right panel looks broken. Setup is the only route hitting this so
  // far. MobileActions still renders unconditionally; on desktop we just
  // drop the empty slot.
  const infoColumnEmpty = !!hidePlayback && !!hideGamePanel;
  // The board's aspect-square fills the available width — which on tall/wide
  // desktops can blow past the viewport vertically. The maxWidth formula
  // reserves room for chrome (top bar, padding, playback strip). When the
  // route adds content below the board (the setup tray), reserve more so
  // board + below stack inside the viewport instead of clipping.
  const reservedVertical = belowBoard ? 380 : 220;
  const boardMaxWidth = belowBoard
    ? `min(100%, max(320px, calc(100vh - ${reservedVertical}px)))`
    : `min(100%, max(320px, min(80vh, calc(100vh - ${reservedVertical}px))))`;

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4 p-3 sm:p-4 lg:p-6 max-w-[1700px] mx-auto w-full">
      <div className="flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4">
        {/* Board column */}
        <div className="flex items-center justify-center lg:flex-1 lg:min-h-0">
          <div
            className="w-full flex flex-col gap-2"
            style={{ maxWidth: boardMaxWidth }}
          >
            {showStrips && <PlayerStrip side="opponent" />}
            <div className="relative aspect-square w-full">
              <EvalBar />
              {renderMode === '2d' ? <Board2D /> : <Board3DStub />}
            </div>
            {showStrips && <PlayerStrip side="self" />}
            {belowBoard}
          </div>
        </div>

        {/* Info column — playback, engine status, move list, idea.
            Hidden on desktop entirely when the route has nothing to show
            in this slot (e.g. /setup), so the board gets the freed width
            instead of staring at an empty gap. MobileActions stays inline
            on mobile regardless — the action row anchors the bottom-sheet
            entry points and is per-route. */}
        <div className={clsx(
          'flex flex-col gap-3',
          infoColumnEmpty ? 'lg:hidden' : 'lg:w-80 lg:min-h-0',
        )}>
          {!hidePlayback && (
            <>
              <PlaybackControls />
              <AnalysisBar />
              <MoveNote />
            </>
          )}
          <MobileActions />
          {!hideGamePanel && (
            <div className="hidden lg:flex flex-col flex-1 min-h-0">
              <GamePanel />
            </div>
          )}
        </div>

        {/* Route panel — dedicated 3rd column on desktop, hidden on
            mobile (lives in a bottom-sheet there). Only renders when the
            route actually has content for it. */}
        {rightPanel && (
          <aside className="hidden lg:flex lg:w-[340px] xl:w-[380px] shrink-0 lg:min-h-0 flex-col">
            <div className="panel flex-1 min-h-0 flex flex-col p-4">
              {rightPanel}
            </div>
          </aside>
        )}
      </div>
      <MobileDrawers />
    </div>
  );
}
