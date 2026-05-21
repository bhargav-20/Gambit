import { useGameStore } from '@/core/store/gameStore';
import { pairMoves } from '@/core/chess/pgn';
import clsx from 'clsx';
import { useEffect, useRef } from 'react';

export function MoveList() {
  const moves = useGameStore((s) => s.game.moves);
  const ply = useGameStore((s) => s.ply);
  const goTo = useGameStore((s) => s.goTo);
  const containerRef = useRef<HTMLDivElement>(null);

  const pairs = pairMoves(moves);

  // Auto-scroll so the active move stays visible — but only within this
  // container, so document-level scrolling is never triggered.
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const active = root.querySelector('[data-active="true"]') as HTMLElement | null;
    if (!active) return;
    const rRoot = root.getBoundingClientRect();
    const rAct = active.getBoundingClientRect();
    if (rAct.top < rRoot.top) {
      root.scrollTop += rAct.top - rRoot.top - 8;
    } else if (rAct.bottom > rRoot.bottom) {
      root.scrollTop += rAct.bottom - rRoot.bottom + 8;
    }
  }, [ply]);

  if (moves.length === 0) {
    return (
      <div className="panel p-6 text-center text-ink-muted text-sm">
        No moves yet. Pick an opening or paste a PGN.
      </div>
    );
  }

  return (
    <div className="panel p-2 h-full overflow-y-auto" ref={containerRef}>
      <table className="w-full text-sm font-mono tabular-nums">
        <tbody>
          {pairs.map(([w, b], i) => {
            const wPly = i * 2 + 1;
            const bPly = i * 2 + 2;
            return (
              <tr key={i} className="hover:bg-bg-subtle/40">
                <td className="w-10 text-right pr-2 text-ink-faint">{i + 1}.</td>
                <td className="w-1/2">
                  {w && (
                    <button
                      data-active={ply === wPly}
                      onClick={() => goTo(wPly)}
                      className={clsx(
                        'w-full text-left px-2 py-1 rounded transition-colors',
                        ply === wPly ? 'bg-accent text-bg font-semibold' : 'hover:bg-bg-subtle text-ink',
                      )}
                    >
                      {w.san}
                    </button>
                  )}
                </td>
                <td className="w-1/2">
                  {b && (
                    <button
                      data-active={ply === bPly}
                      onClick={() => goTo(bPly)}
                      className={clsx(
                        'w-full text-left px-2 py-1 rounded transition-colors',
                        ply === bPly ? 'bg-accent text-bg font-semibold' : 'hover:bg-bg-subtle text-ink',
                      )}
                    >
                      {b.san}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
