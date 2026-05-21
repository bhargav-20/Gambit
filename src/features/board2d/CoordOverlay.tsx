/**
 * Coordinate labels rendered OUTSIDE the board edges. Each rank label is
 * vertically centered on its corresponding row; each file label is
 * horizontally centered on its corresponding column. Honors board orientation
 * (when Black is at bottom, the ranks and files reverse).
 *
 * Uses inline styles (not Tailwind arbitrary-value classes) for the dynamic
 * pixel sizing so the layout works even when Tailwind's JIT cache hasn't
 * picked up these specific class strings.
 */
interface Props {
  orientation: 'white' | 'black';
  /** Width of the right rail (rank labels) in pixels. Matches the chessground inset. */
  padPx: number;
}

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export function CoordOverlay({ orientation, padPx }: Props) {
  // For white at bottom: ranks read 8,7,6,5,4,3,2,1 top to bottom; files a,b,..h left to right.
  // For black at bottom: ranks read 1,2,3,4,5,6,7,8 top to bottom; files h,g,..a left to right.
  const ranksDisplay = orientation === 'white' ? [...RANKS].reverse() : RANKS;
  const filesDisplay = orientation === 'white' ? FILES : [...FILES].reverse();

  return (
    <>
      {/* Rank labels: column on the right, each label centered on its row */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: `${padPx}px`,
          width: `${padPx}px`,
          display: 'flex',
          flexDirection: 'column',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {ranksDisplay.map((r) => (
          <span
            key={r}
            className="font-semibold text-ink-muted tabular-nums"
            style={{
              flex: '1 1 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              lineHeight: 1,
            }}
          >
            {r}
          </span>
        ))}
      </div>
      {/* File labels: row at the bottom, each label centered on its column */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          left: 0,
          right: `${padPx}px`,
          bottom: 0,
          height: `${padPx}px`,
          display: 'flex',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {filesDisplay.map((f) => (
          <span
            key={f}
            className="font-semibold text-ink-muted lowercase"
            style={{
              flex: '1 1 0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              lineHeight: 1,
            }}
          >
            {f}
          </span>
        ))}
      </div>
    </>
  );
}
