import { useEffect, useRef } from 'react';
import { useUiStore } from '@/core/store/uiStore';
import { useGameStore } from '@/core/store/gameStore';
import { usePvpStore } from '@/core/store/pvpStore';
import { ThemeStyles } from '@/features/themes/ThemeStyles';
import { Board2D } from '@/features/board2d/Board2D';
import { Board3DStub } from '@/features/board3d/Board3DStub';
import { PlaybackControls } from '@/features/playback/PlaybackControls';
import { GamePanel } from '@/features/playback/GamePanel';
import { MoveNote } from '@/features/playback/MoveNote';
import { usePlayback, useKeyboardShortcuts } from '@/features/playback/usePlayback';
import { useAnalysis } from '@/features/analysis/useAnalysis';
import { EvalBar } from '@/features/analysis/EvalBar';
import { AnalysisBar } from '@/features/analysis/AnalysisBar';
import { PlayerStrip } from '@/features/pvp/PlayerStrip';
import { PvpMatchPanel } from '@/features/pvp/PvpMatchPanel';
import { Header } from './app/Header';
import { Sidebar } from './app/Sidebar';
import { MobileActions } from './app/MobileActions';
import { MobileDrawers } from './app/MobileDrawers';
import { useHashLoader } from './app/HashLoader';
import { OPENINGS } from '@/features/openings/catalog';

export default function App() {
  usePlayback();
  useKeyboardShortcuts(true);
  useHashLoader();
  useAnalysis();

  const renderMode = useUiStore((s) => s.renderMode);
  const loadFromPgn = useGameStore((s) => s.loadFromPgn);
  const mode = useGameStore((s) => s.mode);
  const pvpLocalColor = usePvpStore((s) => s.localColor);
  const seedRanRef = useRef(false);

  // Lock board orientation to the local player's color whenever PvP is active.
  // The user can still see the opponent's pieces at the top, which matches
  // every chess platform's default and keeps the strips reading top-down
  // (opponent above, you below). Done as an effect rather than wiring into
  // gameStore so other modes keep their existing flip behavior.
  useEffect(() => {
    if (mode === 'pvp' && pvpLocalColor) {
      const cur = useGameStore.getState().orientation;
      if (cur !== pvpLocalColor) useGameStore.setState({ orientation: pvpLocalColor });
    }
  }, [mode, pvpLocalColor]);

  // Seed with a popular opening once at startup so the first paint is interesting.
  // We deliberately don't re-seed when the user clears moves (e.g. by starting a
  // puzzle or resetting to an empty board) — that would clobber their intent.
  useEffect(() => {
    if (seedRanRef.current) return;
    if (useGameStore.getState().game.moves.length > 0) {
      seedRanRef.current = true;
      return;
    }
    const london = OPENINGS.find((o) => o.id === 'london-system') ?? OPENINGS[0];
    if (london) loadFromPgn(london.pgn, { title: london.name, eco: london.eco, description: london.description, openingId: london.id, source: 'opening' });
    seedRanRef.current = true;
  }, [loadFromPgn]);

  return (
    // Mobile (< lg): page scrolls; primary view is board + controls + move
    // commentary. Move list, opening idea, and sidebar panels open as bottom
    // sheets on demand. Desktop (lg+): fixed-viewport layout, everything inline.
    <div className="min-h-screen lg:h-screen flex flex-col lg:overflow-hidden">
      <ThemeStyles />
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row gap-4 p-3 sm:p-4 lg:p-6 max-w-[1700px] mx-auto w-full">
        {/* Main column */}
        <div className="flex-1 min-w-0 lg:min-h-0 flex flex-col gap-4">
          <Header />
          <div className="flex-1 lg:min-h-0 flex flex-col lg:flex-row gap-3 lg:gap-4">
            {/* Board. In PvP mode, player strips sandwich the board (opponent
                on top, you on bottom) — they share the board's max width so
                they always line up with its edges. */}
            <div className="flex items-center justify-center lg:flex-1 lg:min-h-0">
              <div
                className="w-full flex flex-col gap-2"
                style={{
                  maxWidth: 'min(100%, max(320px, min(80vh, calc(100vh - 200px))))',
                }}
              >
                {mode === 'pvp' && <PlayerStrip side="opponent" />}
                <div className="relative aspect-square w-full">
                  <EvalBar />
                  {renderMode === '2d' ? <Board2D /> : <Board3DStub />}
                </div>
                {mode === 'pvp' && <PlayerStrip side="self" />}
              </div>
            </div>
            {/* Right column. In PvP, the playback/analysis tools are hidden
                and the match panel takes over — the user is playing live, not
                replaying. Mobile reaches the match panel through a dedicated
                Match sheet (see MobileActions). */}
            <div className="lg:w-80 lg:min-h-0 flex flex-col gap-3">
              {mode !== 'pvp' && (
                <>
                  <PlaybackControls />
                  <AnalysisBar />
                  <MoveNote />
                </>
              )}
              <MobileActions />
              <div className="hidden lg:flex flex-col flex-1 min-h-0">
                {mode === 'pvp' ? <PvpMatchPanel /> : <GamePanel />}
              </div>
            </div>
          </div>
        </div>
        {/* Right sidebar — desktop only inline; mobile uses the Browse drawer */}
        <aside className="hidden lg:block lg:w-[380px] xl:w-[420px] shrink-0 lg:min-h-0">
          <Sidebar />
        </aside>
      </div>
      <footer className="text-center text-[10px] text-ink-faint py-2 border-t border-edge shrink-0">
        <span className="hidden sm:inline">Gambit • Client-side • Shortcuts: ←/→ step • space play/pause • F flip</span>
        <span className="sm:hidden">Gambit • Client-side</span>
      </footer>

      <MobileDrawers />
    </div>
  );
}
