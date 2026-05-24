import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * The `beforeinstallprompt` event is non-standard but supported by Chromium
 * (desktop + Android). We hold a reference to the deferred event so the user
 * can trigger the native install prompt at a time of their choosing rather
 * than the browser's default placement.
 */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface PwaState {
  /** True while a `beforeinstallprompt` event is held and not yet used. */
  canInstall: boolean;
  /** Set once `appinstalled` fires or display-mode flips to standalone. */
  installed: boolean;
  /** SW has new content waiting — surface an "Update ready" banner. */
  needsUpdate: boolean;
  /** SW has finished its initial install and the app is offline-ready. */
  offlineReady: boolean;
  /** User dismissed the one-time install banner; don't show it again. */
  installBannerDismissed: boolean;
  /** User dismissed the "offline ready" toast; don't show it again. */
  offlineReadyDismissed: boolean;

  setCanInstall: (v: boolean) => void;
  setInstalled: (v: boolean) => void;
  setNeedsUpdate: (v: boolean) => void;
  setOfflineReady: (v: boolean) => void;
  dismissInstallBanner: () => void;
  dismissOfflineReady: () => void;
}

export const usePwaStore = create<PwaState>()(
  persist(
    (set) => ({
      canInstall: false,
      installed: false,
      needsUpdate: false,
      offlineReady: false,
      installBannerDismissed: false,
      offlineReadyDismissed: false,

      setCanInstall: (v) => set({ canInstall: v }),
      setInstalled: (v) => set(v ? { installed: true, canInstall: false } : { installed: false }),
      setNeedsUpdate: (v) => set({ needsUpdate: v }),
      setOfflineReady: (v) => set({ offlineReady: v }),
      dismissInstallBanner: () => set({ installBannerDismissed: true }),
      dismissOfflineReady: () => set({ offlineReadyDismissed: true }),
    }),
    {
      name: 'gambit-pwa',
      // Only persist the dismissals — runtime flags (canInstall, needsUpdate)
      // are re-derived on every load by the SW + event listeners.
      partialize: (s) => ({
        installBannerDismissed: s.installBannerDismissed,
        offlineReadyDismissed: s.offlineReadyDismissed,
      }),
    },
  ),
);
