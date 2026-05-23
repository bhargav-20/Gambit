/**
 * Web Audio mixing graph for the narrated-video pipeline.
 *
 *   voiceBufferSource ─┐
 *                      │
 *                      ↓        ┌────────────────┐
 *                  voiceGain    │ ctx.destination│  (live preview, speakers)
 *                      │        └────────────────┘
 *                      ├──────► ╳ merge ────────►┤
 *                      │        ┌────────────────┐
 *                      │        │ MediaStream    │  (Phase 1d capture)
 *                      │        │ AudioDest      │
 *                      │        └────────────────┘
 *                      │
 *   musicBufferSource ─┼─► musicGain ─► duckGain ─┘
 *
 *   - `voiceGain`     — user-controlled voice level (0..1)
 *   - `musicGain`     — user-controlled music level (0..1)
 *   - `duckGain`      — automated: drops to `duckLevel` while voice is
 *                       playing, ramps back to 1 when the voice line ends.
 *                       Separate node so the user's slider position
 *                       (musicGain) isn't clobbered by the duck automation.
 *   - Two outputs in parallel: ctx.destination (for live preview through
 *     the speakers) AND a MediaStreamDestination (for Phase 1d audio
 *     capture into a Blob → ffmpeg).
 *
 * Music is exposed as a single user-supplied AudioBuffer that loops while
 * the mixer is active. We don't pre-render the full mixed timeline — the
 * graph runs in real time. For the export path in Phase 1d the same graph
 * is captured via MediaRecorder, which records whatever it hears as it
 * plays through, giving us a Blob that ffmpeg can mux alongside the
 * rendered video frames.
 */

const VOICE_RAMP_S = 0.04;       // gain ramps on voice line boundaries
const DUCK_ATTACK_S = 0.18;      // how fast the music drops when voice starts
const DUCK_RELEASE_S = 0.4;      // how fast the music rises when voice ends
const DUCK_RELEASE_DELAY_S = 0.1;// small delay so the duck holds through trailing silence

export interface AudioMixerOptions {
  /** Initial voice gain in 0..1. Default 1. */
  voiceVolume?: number;
  /** Initial music gain in 0..1. Default 0.35 — well below the voice. */
  musicVolume?: number;
  /** Initial auto-duck enable. Default true. */
  autoDuck?: boolean;
  /** Music gain multiplier applied while voice is active. Default 0.25
   *  (about -12 dB), matching the plan in the project memory. */
  duckLevel?: number;
}

export class AudioMixer {
  readonly ctx: AudioContext;
  readonly destination: MediaStreamAudioDestinationNode;

  private voiceGain: GainNode;
  private musicGain: GainNode;
  private duckGain: GainNode;
  // Latest source nodes so stop() can cancel them. Voice sources are
  // one-shot per line so we only need to track the currently-playing one
  // (if any); music is a single loop we may need to halt cleanly.
  private currentVoice: AudioBufferSourceNode | null = null;
  private currentMusic: AudioBufferSourceNode | null = null;
  private musicBuffer: AudioBuffer | null = null;
  private autoDuck: boolean;
  private duckLevel: number;
  // While voice is playing we hold the duck depressed; this counter lets
  // overlapping voice lines (shouldn't happen, but defensive) stack
  // correctly without releasing the duck early.
  private duckHolds = 0;

  constructor(opts: AudioMixerOptions = {}) {
    this.ctx = new AudioContext();
    this.voiceGain = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.duckGain = this.ctx.createGain();
    this.voiceGain.gain.value = opts.voiceVolume ?? 1;
    this.musicGain.gain.value = opts.musicVolume ?? 0.35;
    this.duckGain.gain.value = 1;
    this.autoDuck = opts.autoDuck ?? true;
    this.duckLevel = opts.duckLevel ?? 0.25;

    // Capture destination for the export-time pipeline. Always wired up
    // even during preview — `recorder` doesn't run unless someone attaches
    // it, so there's no perf cost to keeping it connected.
    this.destination = this.ctx.createMediaStreamDestination();

    // Wire up: voice → voiceGain → both outputs.
    //          music → musicGain → duckGain → both outputs.
    this.voiceGain.connect(this.ctx.destination);
    this.voiceGain.connect(this.destination);
    this.musicGain.connect(this.duckGain);
    this.duckGain.connect(this.ctx.destination);
    this.duckGain.connect(this.destination);
  }

  setVoiceVolume(v: number) {
    const t = this.ctx.currentTime;
    this.voiceGain.gain.cancelScheduledValues(t);
    this.voiceGain.gain.setTargetAtTime(clamp01(v), t, VOICE_RAMP_S);
  }

  setMusicVolume(v: number) {
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setTargetAtTime(clamp01(v), t, VOICE_RAMP_S);
  }

  setAutoDuck(on: boolean) {
    this.autoDuck = on;
    if (!on) {
      const t = this.ctx.currentTime;
      this.duckGain.gain.cancelScheduledValues(t);
      this.duckGain.gain.setTargetAtTime(1, t, DUCK_RELEASE_S);
    }
  }

  /** Set or clear the background music. Pass `null` to disable music. */
  async setMusic(blob: Blob | null): Promise<void> {
    if (this.currentMusic) {
      try { this.currentMusic.stop(); } catch { /* already stopped */ }
      this.currentMusic.disconnect();
      this.currentMusic = null;
    }
    if (!blob) {
      this.musicBuffer = null;
      return;
    }
    const arr = await blob.arrayBuffer();
    // decodeAudioData mutates its input on some Safaris — copy first so a
    // re-decode on retry doesn't see an empty buffer.
    this.musicBuffer = await this.ctx.decodeAudioData(arr.slice(0));
  }

  /** Start playing the loaded music. No-op if no music was set. */
  startMusic() {
    if (!this.musicBuffer) return;
    if (this.currentMusic) return; // already playing
    const src = this.ctx.createBufferSource();
    src.buffer = this.musicBuffer;
    src.loop = true;
    src.connect(this.musicGain);
    src.start();
    this.currentMusic = src;
  }

  stopMusic() {
    if (!this.currentMusic) return;
    try { this.currentMusic.stop(); } catch { /* already stopped */ }
    this.currentMusic.disconnect();
    this.currentMusic = null;
  }

  /**
   * Play a voice clip. Triggers ducking on entry, releases on completion.
   * Returns a Promise that resolves when the clip finishes playing.
   */
  playVoice(buffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(this.voiceGain);
      this.currentVoice = src;
      this.duckOn();
      src.onended = () => {
        if (this.currentVoice === src) this.currentVoice = null;
        this.duckOff();
        resolve();
      };
      src.start();
    });
  }

  /** Stop any in-flight voice clip immediately. */
  stopVoice() {
    if (!this.currentVoice) return;
    try { this.currentVoice.stop(); } catch { /* fired onended already */ }
    this.currentVoice = null;
    // duckOff fires from onended above on a real stop; defensively call
    // it here too in case the stop happened before onended.
    this.duckOff();
  }

  /** Stop everything and release the AudioContext. */
  async destroy() {
    this.stopVoice();
    this.stopMusic();
    try { await this.ctx.close(); } catch { /* already closed */ }
  }

  // ---------- internals ----------

  private duckOn() {
    if (!this.autoDuck) return;
    this.duckHolds++;
    const t = this.ctx.currentTime;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setTargetAtTime(this.duckLevel, t, DUCK_ATTACK_S);
  }

  private duckOff() {
    if (this.duckHolds <= 0) return;
    this.duckHolds--;
    if (this.duckHolds > 0) return; // still ducked by another in-flight clip
    const t = this.ctx.currentTime + DUCK_RELEASE_DELAY_S;
    this.duckGain.gain.cancelScheduledValues(t);
    this.duckGain.gain.setTargetAtTime(1, t, DUCK_RELEASE_S);
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
