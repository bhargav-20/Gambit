import { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { ThemePanel } from '@/features/themes/ThemePanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Settings slide-over. On desktop it's a 360 px right-edge panel; on mobile
 * it expands to full width. Wraps the existing ThemePanel so we don't have
 * to duplicate the theme/piece-set/animation controls.
 *
 * Esc closes it. Click-outside-the-panel closes it. The route `/settings`
 * navigates here via AppShell.
 */
export function SettingsSlideOver({ open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-sm cursor-default"
        aria-label="Close settings"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        className={clsx(
          'absolute right-0 top-0 bottom-0 w-full sm:w-[420px] bg-bg-panel backdrop-blur-xl border-l border-edge',
          'flex flex-col shadow-glass transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-edge shrink-0">
          <h2 className="font-display text-base">Settings</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <ThemePanel />
        </div>
      </aside>
    </div>
  );
}
