import { useEffect, useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { gameToPgn } from '@/core/chess/pgn';
import { ExportPanel } from '@/features/export/ExportPanel';
import { X, Link2, Check, FileText, Hash, Share2 } from 'lucide-react';
import clsx from 'clsx';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * One-stop modal for getting the current game OUT — three lightweight copy
 * actions (shareable URL, PGN text, current FEN) plus the heavyweight
 * "render as video" flow from the existing ExportPanel.
 *
 * Previously this was two surfaces (Copy share link lived in ImportPanel,
 * video export had its own modal). Merging them here matches user intent:
 * every action is "I want to send this position somewhere."
 */
export function ShareModal({ open, onClose }: Props) {
  const game = useGameStore((s) => s.game);
  const currentFen = useGameStore((s) => s.currentFen);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const buildShareLink = (): string | null => {
    const pgn = game.moves.length ? gameToPgn(game) : '';
    if (!pgn) return null;
    const url = new URL(window.location.href);
    // Preserve the router's hash path if present, append the pgn query.
    // window.location.hash is "#/route" — we encode the pgn as a query so
    // it survives the route prefix and HashLoader can find it on load.
    const path = url.hash.split('?')[0] || '#/analyze';
    url.hash = `${path}?pgn=${encodeURIComponent(pgn)}`;
    return url.toString();
  };

  const pgnText = game.moves.length ? gameToPgn(game) : '';
  const fenText = currentFen();
  const canShare = game.moves.length > 0;

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
        aria-label="Close share"
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
        aria-label="Share game"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-edge shrink-0">
          <div className="flex items-center gap-2">
            <Share2 size={16} className="text-accent" />
            <h2 className="font-display text-base">Share &amp; export</h2>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Lightweight copy actions */}
          <section className="flex flex-col gap-2">
            <span className="label">Copy</span>
            <CopyRow
              label="Share link"
              icon={<Link2 size={12} />}
              getValue={buildShareLink}
              disabled={!canShare}
              disabledHint="Load a game to share a link"
            />
            <CopyRow
              label="PGN"
              icon={<FileText size={12} />}
              getValue={() => pgnText || null}
              disabled={!canShare}
              disabledHint="No moves to copy yet"
            />
            <CopyRow
              label="FEN"
              icon={<Hash size={12} />}
              getValue={() => fenText}
            />
            <p className="text-[10px] text-ink-faint">
              The share link encodes the PGN in the URL — no server needed.
            </p>
          </section>

          <div className="divider" />

          {/* Video export — heavier flow, takes the rest of the modal */}
          <section className="flex flex-col gap-2 min-h-0">
            <span className="label">Video</span>
            <div className="min-h-0">
              <ExportPanel />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function CopyRow({
  label, icon, getValue, disabled, disabledHint,
}: {
  label: string;
  icon: React.ReactNode;
  /** Lazy so we don't recompute on every render — only on click. */
  getValue: () => string | null;
  disabled?: boolean;
  disabledHint?: string;
}) {
  const [copied, setCopied] = useState(false);
  const click = async () => {
    const v = getValue();
    if (!v) return;
    try {
      await navigator.clipboard.writeText(v);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be blocked; nothing actionable for us.
    }
  };
  return (
    <button
      className={clsx('btn justify-between text-xs', copied && 'border-good/40 text-good')}
      onClick={click}
      disabled={disabled}
      title={disabled ? disabledHint : undefined}
    >
      <span className="flex items-center gap-1.5">
        <span className="text-accent">{icon}</span>
        {label}
      </span>
      <span className="text-[10px] flex items-center gap-1">
        {copied ? (
          <>
            <Check size={11} /> Copied
          </>
        ) : (
          'Copy'
        )}
      </span>
    </button>
  );
}
