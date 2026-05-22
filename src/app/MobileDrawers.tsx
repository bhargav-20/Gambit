import { useMatch } from 'react-router-dom';
import { useUiStore } from '@/core/store/uiStore';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MoveList } from '@/features/playback/MoveList';
import { IdeaPanel } from '@/features/openings/IdeaPanel';
import { OpeningsPanel } from '@/features/openings/OpeningsPanel';
import { PuzzlePanel } from '@/features/puzzles/PuzzlePanel';
import { PvpMatchPanel } from '@/features/pvp/PvpMatchPanel';

/**
 * Mobile bottom-sheets, one per kind of overlayable content. Only one is
 * open at a time, controlled by `uiStore.mobileSheet`. Sheets render the
 * same component the desktop sidebar/right-column would — there's no
 * mobile-only chrome here.
 *
 * The `catalog` sheet swaps between OpeningsPanel and PuzzlePanel based on
 * the current route. That matches the desktop Browse tab's behavior.
 */
export function MobileDrawers() {
  const sheet = useUiStore((s) => s.mobileSheet);
  const setSheet = useUiStore((s) => s.setMobileSheet);
  const isOpenings = useMatch('/openings/*');
  const isPuzzles = useMatch('/puzzles/*');
  const close = () => setSheet(null);

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
      <BottomSheet open={sheet === 'catalog'} onClose={close} title={isOpenings ? 'Openings' : isPuzzles ? 'Puzzles' : 'Catalog'} heightVh={0.85}>
        {isOpenings && <OpeningsPanel />}
        {isPuzzles && <PuzzlePanel />}
      </BottomSheet>
      <BottomSheet open={sheet === 'match'} onClose={close} title="Match" heightVh={0.7}>
        <PvpMatchPanel />
      </BottomSheet>
    </>
  );
}
