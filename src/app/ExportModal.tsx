import { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { ExportPanel } from '@/features/export/ExportPanel';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Export modal — wraps the existing ExportPanel. Centered card on desktop,
 * full-height sheet on mobile. The trigger button in TopBar is disabled
 * when there's no loaded game, so we don't have to add empty-state copy
 * here.
 */
export function ExportModal({ open, onClose }: Props) {
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
        'fixed inset-0 z-50 transition-opacity flex items-center justify-center p-3 sm:p-6',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-sm cursor-default"
        aria-label="Close export"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <div
        className={clsx(
          'relative panel w-full sm:max-w-md max-h-full flex flex-col',
          'transition-transform duration-200',
          open ? 'scale-100' : 'scale-95',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Export game"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-edge shrink-0">
          <h2 className="font-display text-base">Export game</h2>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <X size={16} />
          </button>
        </header>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          <ExportPanel />
        </div>
      </div>
    </div>
  );
}
