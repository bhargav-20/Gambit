import type { NarrationScript } from '../narration';
import { synthesize } from './kokoroTts';

/**
 * Build a single timeline of synthesized speech that can be muxed against
 * the video. Each script line is synthesized via kokoro, then placed at a
 * computed start offset along a combined AudioBuffer.
 *
 * The video timing follows the audio: each move's on-screen duration is
 * stretched to max(animMs + minHoldMs, lineMs + tailMs) so the narration
 * for that move can complete before the visual jumps to the next.
 *
 * Returns:
 *   - lineTimings: per-line offsets + durations. The video renderer uses
 *     this to know how long to hold each frame snapshot.
 *   - combinedBuffer: a single mono AudioBuffer containing the whole
 *     timeline (with silence between lines as needed). Caller renders
 *     this through the mixer to WAV bytes for ffmpeg.
 */

export interface TimelineOptions {
  voice: string;
  /** Minimum silence held after each line ends before the next begins,
   *  in milliseconds. Default 250 ms — gives the listener a beat to
   *  digest before the next move's commentary. */
  tailMs?: number;
  /** Animation duration for each move (the piece-glide). Passed in from
   *  the export pipeline so we know how much visual time each move needs
   *  even when its narration is short. */
  animMs?: number;
  /** Minimum hold per move on top of the animation. Default 700 ms. */
  minHoldMs?: number;
  /** Intro pause before the first move plays. Default 800 ms. */
  introHoldMs?: number;
  /** Outro pause after the last move's narration. Default 1200 ms. */
  outroHoldMs?: number;
  /** AudioContext used to create AudioBuffers. Tests can pass a fixed
   *  context to keep sample-rate behaviour deterministic. Default: a
   *  fresh AudioContext. */
  audioCtx?: AudioContext;
  /** Fired once per line as synthesis completes. Used by the UI for the
   *  big progress bar. */
  onProgress?: (done: number, total: number) => void;
}

export interface LineTiming {
  /** 0 = intro, 1..N = move N (1-indexed), N+1 = outro. */
  kind: 'intro' | 'move' | 'outro';
  /** For kind === 'move', the half-move index in the game (0-indexed). */
  movePly?: number;
  /** Start offset in the combined timeline, milliseconds. */
  startMs: number;
  /** Length of the synthesized speech for this line, milliseconds. */
  speechMs: number;
  /** How long this slot occupies on the video timeline (≥ speechMs). */
  slotMs: number;
}

export interface NarrationTimeline {
  combinedBuffer: AudioBuffer;
  lineTimings: LineTiming[];
  totalMs: number;
  sampleRate: number;
}

export async function buildNarrationTimeline(
  script: NarrationScript,
  opts: TimelineOptions,
): Promise<NarrationTimeline> {
  const tailMs = opts.tailMs ?? 250;
  const animMs = opts.animMs ?? 350;
  const minHoldMs = opts.minHoldMs ?? 700;
  const introHoldMs = opts.introHoldMs ?? 800;
  const outroHoldMs = opts.outroHoldMs ?? 1200;
  // Use a shared AudioContext if the caller passed one; otherwise spin up
  // a fresh one and close it on exit. The buffer that comes back is
  // detachable — Web Audio buffers don't depend on the context that
  // created them once they're populated.
  const ownedCtx = !opts.audioCtx;
  const ctx = opts.audioCtx ?? new AudioContext();

  // ----- Phase 1: synthesize every line in sequence -----
  // kokoro doesn't parallelize internally and Transformers.js's worker
  // pool would compete with the main thread, so a sequential loop is
  // both simpler and not measurably slower than batching.
  type Synthesized = { kind: LineTiming['kind']; movePly?: number; samples: Float32Array; sampleRate: number; speechMs: number };
  const lines: Array<{ kind: LineTiming['kind']; movePly?: number; text: string }> = [
    { kind: 'intro', text: script.intro },
    ...script.perMove.map((text, i) => ({ kind: 'move' as const, movePly: i, text })),
    { kind: 'outro', text: script.outro },
  ];

  const synthesized: Synthesized[] = [];
  for (let i = 0; i < lines.length; i++) {
    const { kind, movePly, text } = lines[i];
    const { samples, sampleRate } = await synthesize(text, { voice: opts.voice });
    const speechMs = (samples.length / sampleRate) * 1000;
    synthesized.push({ kind, movePly, samples, sampleRate, speechMs });
    opts.onProgress?.(i + 1, lines.length);
  }

  // ----- Phase 2: build the timeline of start offsets -----
  // All kokoro voices share the same output sample rate at the moment
  // (24000). If a future voice diverges, we'd need a resampling pass —
  // assert here so a silent mismatch surfaces fast.
  const sampleRate = synthesized[0].sampleRate;
  for (const s of synthesized) {
    if (s.sampleRate !== sampleRate) {
      throw new Error(`Inconsistent sample rates in narration timeline (${s.sampleRate} vs ${sampleRate})`);
    }
  }

  const timings: LineTiming[] = [];
  let cursorMs = 0;
  for (const s of synthesized) {
    // Slot duration: enough room for the speech itself plus its tail,
    // and (for move slots) at least the visual move-animation + minimum
    // hold so the board has time to glide before the next move starts.
    let slotMs: number;
    if (s.kind === 'intro') {
      slotMs = Math.max(s.speechMs + tailMs, introHoldMs);
    } else if (s.kind === 'outro') {
      slotMs = Math.max(s.speechMs + tailMs, outroHoldMs);
    } else {
      slotMs = Math.max(s.speechMs + tailMs, animMs + minHoldMs);
    }
    timings.push({ kind: s.kind, movePly: s.movePly, startMs: cursorMs, speechMs: s.speechMs, slotMs });
    cursorMs += slotMs;
  }
  const totalMs = cursorMs;

  // ----- Phase 3: render the combined AudioBuffer -----
  const totalSamples = Math.ceil((totalMs / 1000) * sampleRate);
  const combined = ctx.createBuffer(1, totalSamples, sampleRate);
  const dst = combined.getChannelData(0);
  for (let i = 0; i < synthesized.length; i++) {
    const s = synthesized[i];
    const startSample = Math.floor((timings[i].startMs / 1000) * sampleRate);
    // Defensive bound — should never trigger if the math above is right,
    // but better a clean clip than an out-of-bounds write.
    const writable = Math.min(s.samples.length, dst.length - startSample);
    for (let j = 0; j < writable; j++) dst[startSample + j] = s.samples[j];
  }

  if (ownedCtx) {
    try { await ctx.close(); } catch { /* already closed */ }
  }

  return { combinedBuffer: combined, lineTimings: timings, totalMs, sampleRate };
}

/**
 * Convert an AudioBuffer to a 16-bit PCM WAV file as bytes. ffmpeg
 * accepts this directly via writeFile('audio.wav', bytes).
 *
 * Mono only — the mixer's MediaStream destination output is mono too, so
 * upgrading to stereo would require also stretching the music handling.
 * Acceptable tradeoff for v1; export can be remastered later.
 */
export function audioBufferToWav(buffer: AudioBuffer): Uint8Array {
  const channels = 1;
  const samples = buffer.length;
  const sampleRate = buffer.sampleRate;
  const pcmBytes = samples * 2;
  const totalBytes = 44 + pcmBytes;
  const out = new ArrayBuffer(totalBytes);
  const view = new DataView(out);
  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmBytes, true);
  writeAscii(view, 8, 'WAVE');
  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);            // PCM fmt chunk size
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true); // byte rate
  view.setUint16(32, channels * 2, true);  // block align
  view.setUint16(34, 16, true);            // bits per sample
  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcmBytes, true);
  // PCM samples — float32 in -1..1 → int16
  const channel = buffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < samples; i++) {
    const v = Math.max(-1, Math.min(1, channel[i]));
    view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
    offset += 2;
  }
  return new Uint8Array(out);
}

function writeAscii(view: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
}
