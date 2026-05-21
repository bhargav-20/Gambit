import { usePvpStore } from '@/core/store/pvpStore';
import type { PvpColor } from '@/core/store/pvpStore';
import clsx from 'clsx';
import { useEffect, useState } from 'react';

interface Props {
  /** Which side this strip represents — local player or opponent. */
  side: 'self' | 'opponent';
}

/**
 * One row of player chrome: name, connection dot (opponent only), and clock.
 * Renders above/below the board during PvP mode.
 */
export function PlayerStrip({ side }: Props) {
  const localName = usePvpStore((s) => s.localName);
  const opponentName = usePvpStore((s) => s.opponentName);
  const localColor = usePvpStore((s) => s.localColor);
  const whiteMs = usePvpStore((s) => s.whiteMs);
  const blackMs = usePvpStore((s) => s.blackMs);
  const activeColor = usePvpStore((s) => s.activeColor);
  const rttMs = usePvpStore((s) => s.rttMs);
  const channelStatus = usePvpStore((s) => s.channelStatus);
  const graceDeadlineAt = usePvpStore((s) => s.graceDeadlineAt);

  if (!localColor) return null;
  const opponentColor: PvpColor = localColor === 'white' ? 'black' : 'white';
  const myColor: PvpColor = side === 'self' ? localColor : opponentColor;
  const myMs = myColor === 'white' ? whiteMs : blackMs;
  const isActive = activeColor === myColor;
  const name = side === 'self' ? (localName || 'You') : (opponentName || 'Opponent');

  return (
    <div
      className={clsx(
        'panel-tight px-3 py-2 flex items-center gap-2',
        isActive && 'border-accent/50 bg-accent/[0.06]',
      )}
    >
      {/* Color pip — small circle so the player always knows which side they are
          regardless of name length. */}
      <span
        className={clsx(
          'w-2.5 h-2.5 rounded-full border',
          myColor === 'white' ? 'bg-white border-white/30' : 'bg-black border-white/40',
        )}
      />
      <span className="font-medium text-sm text-ink truncate flex-1">{name}</span>

      {/* Opponent-only: connection health dot. RTT thresholds:
              < 50ms green, < 200ms amber, else red.
          On disconnect the dot turns red and a grace countdown shows next to the clock. */}
      {side === 'opponent' && (
        <ConnectionDot
          rttMs={rttMs}
          channelStatus={channelStatus}
          graceDeadlineAt={graceDeadlineAt}
        />
      )}

      <ClockDisplay ms={myMs} active={isActive} />
    </div>
  );
}

function ConnectionDot({
  rttMs,
  channelStatus,
  graceDeadlineAt,
}: {
  rttMs: number | null;
  channelStatus: ReturnType<typeof usePvpStore.getState>['channelStatus'];
  graceDeadlineAt: number | null;
}) {
  const [graceSec, setGraceSec] = useState<number | null>(null);
  useEffect(() => {
    if (channelStatus !== 'disconnected' || graceDeadlineAt === null) {
      setGraceSec(null);
      return;
    }
    const id = window.setInterval(() => {
      const remaining = Math.max(0, graceDeadlineAt - performance.now());
      setGraceSec(Math.ceil(remaining / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [channelStatus, graceDeadlineAt]);

  const color =
    channelStatus === 'disconnected' || channelStatus === 'closed'
      ? 'bg-bad'
      : rttMs === null
        ? 'bg-ink-faint'
        : rttMs < 50
          ? 'bg-good'
          : rttMs < 200
            ? 'bg-warn'
            : 'bg-bad';

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={clsx('w-1.5 h-1.5 rounded-full', color, channelStatus === 'disconnected' && 'animate-pulse')}
        title={
          channelStatus === 'disconnected'
            ? 'Opponent disconnected'
            : rttMs !== null
              ? `${Math.round(rttMs)}ms`
              : 'Measuring…'
        }
      />
      {graceSec !== null && graceSec >= 0 && (
        <span className="text-[10px] text-bad font-mono">{graceSec}s</span>
      )}
    </span>
  );
}

function ClockDisplay({ ms, active }: { ms: number; active: boolean }) {
  const total = Math.max(0, ms);
  const totalSec = Math.floor(total / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const tenths = Math.floor((total % 1000) / 100);
  const showTenths = total < 10_000;

  const urgency =
    total <= 0 ? 'flag'
    : total < 10_000 ? 'critical'
    : total < 30_000 ? 'low'
    : 'normal';

  return (
    <span
      className={clsx(
        'font-mono tabular-nums text-base px-2 py-0.5 rounded-md transition-colors',
        active && urgency === 'normal' && 'text-ink font-semibold',
        !active && urgency === 'normal' && 'text-ink-muted',
        urgency === 'low' && 'text-warn',
        urgency === 'critical' && 'text-bad',
        urgency === 'flag' && 'text-bad font-bold',
        active && urgency === 'critical' && 'animate-pulse',
      )}
    >
      {mins}:{secs.toString().padStart(2, '0')}
      {showTenths && (
        <span className="text-[0.75em] opacity-80">.{tenths}</span>
      )}
    </span>
  );
}
