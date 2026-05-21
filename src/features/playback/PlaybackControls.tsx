import { useGameStore } from '@/core/store/gameStore';
import type { PlaybackSpeed } from '@/core/store/gameStore';
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Pause, Play, RotateCcw, FlipVertical2 } from 'lucide-react';
import clsx from 'clsx';

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 1.5, 2, 3];

export function PlaybackControls() {
  const ply = useGameStore((s) => s.ply);
  const total = useGameStore((s) => s.game.moves.length);
  const playing = useGameStore((s) => s.playing);
  const speed = useGameStore((s) => s.speed);
  const first = useGameStore((s) => s.first);
  const prev = useGameStore((s) => s.prev);
  const next = useGameStore((s) => s.next);
  const last = useGameStore((s) => s.last);
  const toggle = useGameStore((s) => s.toggle);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const goTo = useGameStore((s) => s.goTo);
  const flip = useGameStore((s) => s.flip);

  return (
    <div className="panel p-3 flex flex-col gap-3">
      <div className="flex items-center gap-1.5">
        <button className="btn-icon" onClick={first} title="Start (Home)"><ChevronFirst size={16} /></button>
        <button className="btn-icon" onClick={prev} title="Previous (←)"><ChevronLeft size={16} /></button>
        <button
          className={clsx('btn h-9 px-4', playing ? 'btn-primary' : '')}
          onClick={toggle}
          title="Play / Pause (Space)"
          disabled={total === 0}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
          <span>{playing ? 'Pause' : 'Play'}</span>
        </button>
        <button className="btn-icon" onClick={next} title="Next (→)"><ChevronRight size={16} /></button>
        <button className="btn-icon" onClick={last} title="End (End)"><ChevronLast size={16} /></button>
        <div className="flex-1" />
        <button className="btn-icon" onClick={flip} title="Flip board (F)"><FlipVertical2 size={16} /></button>
        <button className="btn-icon" onClick={first} title="Reset to start"><RotateCcw size={16} /></button>
      </div>

      <div className="flex items-center gap-3 px-1">
        <span className="font-mono text-xs text-ink-muted tabular-nums w-12">
          {ply}/{total}
        </span>
        <input
          type="range"
          min={0}
          max={Math.max(total, 1)}
          value={ply}
          onChange={(e) => goTo(Number(e.target.value))}
          className="flex-1 accent-accent"
          disabled={total === 0}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <span className="label">Speed</span>
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={clsx('btn h-7 px-2 text-xs', speed === s && 'border-accent text-accent')}
            onClick={() => setSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>
    </div>
  );
}
