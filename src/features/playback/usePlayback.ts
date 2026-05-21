import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';

/**
 * Tick driver: when playing, advance the cursor on a timer derived from speed.
 * Base cadence is 900ms per half-move at 1x; clamped between 200ms and 2000ms.
 */
export function usePlayback() {
  const playing = useGameStore((s) => s.playing);
  const speed = useGameStore((s) => s.speed);
  const ply = useGameStore((s) => s.ply);
  const next = useGameStore((s) => s.next);
  const totalMoves = useGameStore((s) => s.game.moves.length);

  useEffect(() => {
    if (!playing) return;
    if (ply >= totalMoves) {
      useGameStore.setState({ playing: false });
      return;
    }
    const ms = Math.max(200, Math.min(2000, Math.round(900 / speed)));
    const id = window.setTimeout(next, ms);
    return () => window.clearTimeout(id);
  }, [playing, speed, ply, totalMoves, next]);
}

/** Bind common keyboard shortcuts: ←/→ step, space toggles play, Home/End jump. */
export function useKeyboardShortcuts(enabled = true) {
  const next = useGameStore((s) => s.next);
  const prev = useGameStore((s) => s.prev);
  const first = useGameStore((s) => s.first);
  const last = useGameStore((s) => s.last);
  const toggle = useGameStore((s) => s.toggle);
  const flip = useGameStore((s) => s.flip);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      switch (e.key) {
        case 'ArrowRight': e.preventDefault(); next(); break;
        case 'ArrowLeft':  e.preventDefault(); prev(); break;
        case 'Home':       e.preventDefault(); first(); break;
        case 'End':        e.preventDefault(); last(); break;
        case ' ':          e.preventDefault(); toggle(); break;
        case 'f': case 'F': e.preventDefault(); flip(); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [enabled, next, prev, first, last, toggle, flip]);
}
