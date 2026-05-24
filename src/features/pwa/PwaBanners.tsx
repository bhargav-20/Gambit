import { Download, RefreshCw, X } from 'lucide-react';
import clsx from 'clsx';
import { usePwaStore } from './pwaStore';
import { applyUpdate, promptInstall } from './register';

/**
 * Two stacked bottom-center toasts, mounted once at AppShell level:
 *   • "Install Gambit" — appears the first time the browser fires
 *     beforeinstallprompt, until dismissed. Permanently dismissable.
 *   • "Update ready" — appears when a new SW is waiting, until reloaded.
 *
 * Both are pinned to the bottom edge with safe-area padding so they don't
 * collide with the mobile MobileActions bar.
 */
export function PwaBanners() {
  const canInstall = usePwaStore((s) => s.canInstall);
  const installed = usePwaStore((s) => s.installed);
  const needsUpdate = usePwaStore((s) => s.needsUpdate);
  const dismissed = usePwaStore((s) => s.installBannerDismissed);
  const dismiss = usePwaStore((s) => s.dismissInstallBanner);

  const showInstall = canInstall && !installed && !dismissed;

  return (
    <div
      className={clsx(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-center gap-2',
        'px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        // Sit above the mobile action bar (h-14 ≈ 56px) so banners don't
        // get obscured on small screens.
        'lg:pb-3 mb-16 lg:mb-0',
      )}
      aria-live="polite"
    >
      {needsUpdate && <UpdateToast />}
      {showInstall && <InstallToast onDismiss={dismiss} />}
    </div>
  );
}

function InstallToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      role="dialog"
      aria-label="Install Gambit"
      className={clsx(
        'pointer-events-auto flex items-center gap-3 max-w-sm w-full',
        'bg-bg-panel border border-edge rounded-xl shadow-glass backdrop-blur-xl',
        'px-3 py-2.5',
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <Download size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">Install Gambit</div>
        <div className="text-[11px] text-ink-faint leading-tight mt-0.5">
          Add to your home screen — works offline.
        </div>
      </div>
      <button
        onClick={() => {
          void promptInstall();
        }}
        className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-accent text-bg hover:bg-accent/90 transition-colors"
      >
        Install
      </button>
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="btn-icon shrink-0"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function UpdateToast() {
  return (
    <div
      role="dialog"
      aria-label="Update available"
      className={clsx(
        'pointer-events-auto flex items-center gap-3 max-w-sm w-full',
        'bg-bg-panel border border-accent/40 rounded-xl shadow-glass backdrop-blur-xl',
        'px-3 py-2.5',
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
        <RefreshCw size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium leading-tight">New version ready</div>
        <div className="text-[11px] text-ink-faint leading-tight mt-0.5">
          Reload to apply the update.
        </div>
      </div>
      <button
        onClick={() => applyUpdate()}
        className="text-xs font-medium px-2.5 py-1.5 rounded-md bg-accent text-bg hover:bg-accent/90 transition-colors"
      >
        Reload
      </button>
    </div>
  );
}
