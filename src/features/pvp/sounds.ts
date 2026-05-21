/**
 * Tiny synthesized sound bank for PvP. No audio assets bundled — each cue is
 * a short oscillator burst with an exponential gain envelope. Keeps the build
 * lean (zero bytes added) and the playback latency near-zero.
 *
 * Cues:
 *   move     — wood-knock tick on every move
 *   promote  — slightly higher pitch variant for promotion
 *   tick     — clock countdown beep when own clock < 10s
 *   flag     — low descending swoop when someone runs out of time
 *   start    — two-note rise at match start
 *   end      — two-note fall at match end (any result)
 */

import { useUiStore } from '@/core/store/uiStore';

export type SoundCue = 'move' | 'promote' | 'tick' | 'flag' | 'start' | 'end';

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  // iOS/Safari suspend the context until a user gesture. resume() is a no-op
  // if already running and harmless on first gesture.
  if (ctx.state === 'suspended') {
    void ctx.resume();
  }
  return ctx;
}

interface Note {
  freq: number;
  /** Seconds from cue start. */
  at: number;
  /** Duration in seconds. */
  dur: number;
  /** Peak gain 0..1. Defaults to 0.18. */
  gain?: number;
  /** Oscillator shape; defaults to 'sine'. */
  type?: OscillatorType;
}

const BANK: Record<SoundCue, Note[]> = {
  move:    [{ freq: 540, at: 0, dur: 0.06, type: 'triangle', gain: 0.16 }],
  promote: [
    { freq: 700, at: 0,    dur: 0.07, type: 'triangle', gain: 0.16 },
    { freq: 980, at: 0.06, dur: 0.07, type: 'triangle', gain: 0.14 },
  ],
  tick:    [{ freq: 880, at: 0, dur: 0.04, type: 'square', gain: 0.10 }],
  flag: [
    { freq: 420, at: 0,    dur: 0.10, type: 'sawtooth', gain: 0.18 },
    { freq: 280, at: 0.10, dur: 0.20, type: 'sawtooth', gain: 0.18 },
  ],
  start: [
    { freq: 520, at: 0,    dur: 0.09, type: 'triangle', gain: 0.16 },
    { freq: 780, at: 0.09, dur: 0.13, type: 'triangle', gain: 0.16 },
  ],
  end: [
    { freq: 600, at: 0,    dur: 0.10, type: 'triangle', gain: 0.18 },
    { freq: 380, at: 0.12, dur: 0.18, type: 'triangle', gain: 0.18 },
  ],
};

export function playSound(cue: SoundCue) {
  const muted = useUiStore.getState().pvpMuted;
  if (muted) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  for (const note of BANK[cue]) {
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.value = note.freq;
    const peak = note.gain ?? 0.18;
    gain.gain.setValueAtTime(0.0001, now + note.at);
    gain.gain.exponentialRampToValueAtTime(peak, now + note.at + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + note.at + note.dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(now + note.at);
    osc.stop(now + note.at + note.dur + 0.02);
  }
}
