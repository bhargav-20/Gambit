import { useUiStore } from '@/core/store/uiStore';
import type { PanelView } from '@/core/store/uiStore';
import { OpeningsPanel } from '@/features/openings/OpeningsPanel';
import { ImportPanel } from '@/features/import/ImportPanel';
import { ExportPanel } from '@/features/export/ExportPanel';
import { ThemePanel } from '@/features/themes/ThemePanel';
import { PuzzlePanel } from '@/features/puzzles/PuzzlePanel';
import { PvpLobby } from '@/features/pvp/PvpLobby';
import { BookOpen, ClipboardPaste, Palette, Video, Puzzle, Swords } from 'lucide-react';
import clsx from 'clsx';

const TABS: Array<{ id: PanelView; label: string; icon: React.ReactNode }> = [
  { id: 'openings', label: 'Openings', icon: <BookOpen size={16} /> },
  { id: 'puzzles', label: 'Puzzles', icon: <Puzzle size={16} /> },
  { id: 'pvp', label: 'Play', icon: <Swords size={16} /> },
  { id: 'import', label: 'Compose', icon: <ClipboardPaste size={16} /> },
  { id: 'export', label: 'Export', icon: <Video size={16} /> },
  { id: 'settings', label: 'Theme', icon: <Palette size={16} /> },
];

export function Sidebar() {
  const active = useUiStore((s) => s.activePanel);
  const setActive = useUiStore((s) => s.setActivePanel);
  const activeTab = TABS.find((t) => t.id === active);

  return (
    <div className="panel h-full flex flex-col">
      {/* Tab strip — icon-only by default, label appears on the active tab so the
          user always sees what they're on without needing all 5 labels to fit. */}
      <div className="flex items-center gap-1 p-2 border-b border-edge">
        {TABS.map((t) => {
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={clsx(
                'flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-medium transition-colors min-w-0',
                isActive
                  ? 'bg-accent text-bg flex-[1.5]'
                  : 'flex-1 text-ink-muted hover:text-ink hover:bg-bg-subtle',
              )}
              title={t.label}
              aria-label={t.label}
              aria-pressed={isActive}
            >
              <span className="shrink-0">{t.icon}</span>
              {isActive && (
                <span className="truncate hidden xs:inline">{t.label}</span>
              )}
            </button>
          );
        })}
      </div>
      {/* Heading row so the active tab name is always visible even on the narrowest viewport */}
      {activeTab && (
        <div className="xs:hidden px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-ink-muted">
          {activeTab.label}
        </div>
      )}
      <div className="flex-1 min-h-0 p-4 overflow-y-auto">
        {active === 'openings' && <OpeningsPanel />}
        {active === 'puzzles' && <PuzzlePanel />}
        {active === 'pvp' && <PvpLobby />}
        {active === 'import' && <ImportPanel />}
        {active === 'export' && <ExportPanel />}
        {active === 'settings' && <ThemePanel />}
      </div>
    </div>
  );
}
