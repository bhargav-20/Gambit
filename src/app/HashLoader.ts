import { useEffect } from 'react';
import { useGameStore } from '@/core/store/gameStore';

/**
 * On mount, check the URL hash for `pgn=...` and hydrate the store.
 * Used for shareable links.
 */
export function useHashLoader() {
  const loadFromPgn = useGameStore((s) => s.loadFromPgn);
  useEffect(() => {
    const h = window.location.hash;
    if (!h) return;
    const match = h.match(/pgn=([^&]+)/);
    if (!match) return;
    try {
      const pgn = decodeURIComponent(match[1]);
      loadFromPgn(pgn, { source: 'url', title: 'Shared game' });
    } catch {
      /* ignore malformed hash */
    }
  }, [loadFromPgn]);
}
