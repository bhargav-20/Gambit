import { useMatch } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MoveList } from '@/features/playback/MoveList';
import { IdeaPanel } from '@/features/openings/IdeaPanel';
import { OpeningsPanel } from '@/features/openings/OpeningsPanel';
import { PuzzlePanel } from '@/features/puzzles/PuzzlePanel';
import { AnalyzePanel } from '@/features/analysis/AnalyzePanel';
import { PvpMatchPanel } from '@/features/pvp/PvpMatchPanel';

/**
 * Mobile bottom-sheets — one per kind of overlayable surface. Only one is
 * open at a time, controlled by `uiStore.mobileSheet`.
 *
 *   moves  — global move list
 *   idea   — opening idea (when one is loaded)
 *   tools  — route-aware. Hosts whatever the desktop right-column shows
 *            for the current route. This is the mobile equivalent of the
 *            new dedicated route panel — same content, different chrome.
 *   match  — kept as a separate slot since PvP is dense enough to deserve
 *            its own dedicated drawer (resign/draw/end-card).
 */
export function MobileDrawers() {
  const sheet = useUiStore((s) => s.mobileSheet);
  const setSheet = useUiStore((s) => s.setMobileSheet);
  const isOpenings = useMatch('/openings/*');
  const isPuzzles = useMatch('/puzzles/*');
  const isAnalyze = useMatch('/analyze');
  const close = () => setSheet(null);

  const toolsTitle = isOpenings
    ? 'Openings'
    : isPuzzles
      ? 'Puzzle'
      : isAnalyze
        ? 'Engine'
        : 'Tools';

  return (
    <>
      <BottomSheet open={sheet === 'moves'} onClose={close} title="Moves" heightVh={0.7}>
        <div className="h-full">
          <MoveList />
        </div>
      </BottomSheet>
      <BottomSheet open={sheet === 'idea'} onClose={close} title="Opening Idea" heightVh={0.85}>
        <IdeaPanel />
      </BottomSheet>
      <BottomSheet open={sheet === 'tools'} onClose={close} title={toolsTitle} heightVh={0.85}>
        {isOpenings && <OpeningsPanel />}
        {isPuzzles && <PuzzlePanel />}
        {isAnalyze && <AnalyzePanel />}
      </BottomSheet>
      <BottomSheet open={sheet === 'match'} onClose={close} title="Match" heightVh={0.7}>
        <PvpMatchPanel />
      </BottomSheet>
    </>
  );
}
