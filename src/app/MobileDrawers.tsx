import { useUiStore } from '@/core/store/uiStore';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { MoveList } from '@/features/playback/MoveList';
import { IdeaPanel } from '@/features/openings/IdeaPanel';
import { Sidebar } from './Sidebar';

/**
 * Renders the mobile bottom-sheet drawers. Only one is open at a time,
 * controlled by `uiStore.mobileSheet`. On desktop these are hidden (the
 * BottomSheet itself uses `lg:hidden`).
 */
export function MobileDrawers() {
  const sheet = useUiStore((s) => s.mobileSheet);
  const setSheet = useUiStore((s) => s.setMobileSheet);
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
      <BottomSheet open={sheet === 'browse'} onClose={close} heightVh={0.88}>
        {/* Sidebar already includes its own tab strip and headings. */}
        <div className="h-full -m-4">
          <Sidebar />
        </div>
      </BottomSheet>
    </>
  );
}
