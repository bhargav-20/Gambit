import { registerSW } from 'virtual:pwa-register';
import { usePwaStore, type BeforeInstallPromptEvent } from './pwaStore';

/**
 * Module-scoped reference to the deferred install prompt. The
 * `beforeinstallprompt` event fires once and must be triggered while a user
 * gesture is on the stack — we stash it here and call .prompt() later from
 * the install button's click handler.
 */
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

/**
 * One-time bootstrap. Called from main.tsx before render so SW registration
 * and install-prompt capture run as early as possible. Safe to call again —
 * subsequent calls no-op because the SW register helper itself is idempotent
 * and listeners are added once per pageload.
 */
let started = false;
export function startPwa() {
  if (started) return;
  started = true;

  // If we're already running as an installed PWA, reflect that in state so
  // the install affordances stay hidden.
  if (typeof window !== 'undefined' && window.matchMedia?.('(display-mode: standalone)').matches) {
    usePwaStore.getState().setInstalled(true);
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    // Block the browser's default mini-infobar so we can surface our own
    // install affordance at a moment that makes sense.
    e.preventDefault();
    deferredInstallPrompt = e as BeforeInstallPromptEvent;
    usePwaStore.getState().setCanInstall(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    usePwaStore.getState().setInstalled(true);
  });

  // SW registration. `registerType: 'prompt'` in vite.config means the
  // generated SW does not auto-claim on update; we surface a banner and
  // call updateSW(true) when the user clicks Reload.
  const updateSW = registerSW({
    onNeedRefresh() {
      usePwaStore.getState().setNeedsUpdate(true);
    },
    onOfflineReady() {
      usePwaStore.getState().setOfflineReady(true);
    },
  });

  // Hand the reload trigger to the store via a side-channel — the UI calls
  // applyUpdate() which closes over updateSW.
  applyUpdateImpl = () => updateSW(true);
}

let applyUpdateImpl: (() => void) | null = null;

/** Activate the waiting SW and reload. Called from the "Update ready" banner. */
export function applyUpdate() {
  applyUpdateImpl?.();
}

/**
 * Trigger the native install prompt. Must be called from a user-gesture
 * handler (click) — browsers reject .prompt() invoked outside of one.
 * Returns true if the user accepted.
 */
export async function promptInstall(): Promise<boolean> {
  const evt = deferredInstallPrompt;
  if (!evt) return false;
  await evt.prompt();
  const choice = await evt.userChoice;
  deferredInstallPrompt = null;
  usePwaStore.getState().setCanInstall(false);
  return choice.outcome === 'accepted';
}
