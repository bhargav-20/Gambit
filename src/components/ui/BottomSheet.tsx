import { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Approximate height as a fraction of viewport (default 0.75). */
  heightVh?: number;
}

/**
 * Slide-up sheet anchored to the bottom of the viewport. Used on mobile to
 * surface the move list, opening idea, and the sidebar panels on demand.
 * Renders a backdrop that dismisses on click. Esc also closes.
 */
export function BottomSheet({ open, onClose, title, children, heightVh = 0.78 }: BottomSheetProps) {
  // Dismiss with Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <div
      className={clsx(
        'fixed inset-0 z-40 lg:hidden transition-opacity',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-sm cursor-default"
        aria-label="Close sheet"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <div
        className={clsx(
          'absolute left-0 right-0 bottom-0 panel rounded-b-none flex flex-col',
          'transition-transform duration-200 ease-out',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
        style={{ height: `${heightVh * 100}vh` }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-edge shrink-0">
          {/* Drag handle visual cue */}
          <div className="absolute left-1/2 -translate-x-1/2 top-1.5 h-1 w-10 rounded-full bg-edge-strong" />
          {title && (
            <h3 className="font-display text-base pt-1">{title}</h3>
          )}
          <button
            onClick={onClose}
            className="btn-icon ml-auto"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
