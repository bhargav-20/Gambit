import type { KokoroTTS } from 'kokoro-js';

/**
 * Lazy-loaded kokoro-js wrapper. Mirrors the ffmpegEncoder.ts pattern:
 * singleton, instantiated on first use, cached forever afterward. The
 * actual model weights (~20 MB at q8 quantization, ~80 MB at fp32)
 * download from Hugging Face Hub the first time and are cached by
 * Transformers.js in IndexedDB after that.
 *
 * Why not self-host the model on GH Pages? Two reasons:
 *   1. 20 MB extra in the repo and on every deploy would dwarf everything
 *      else we ship today, and the model is opt-in.
 *   2. Transformers.js handles HF Hub auth + caching cleanly. Self-hosting
 *      means re-implementing the cache layer or accepting a re-download
 *      on every page load.
 *
 * Privacy note: the first synthesis fires one fetch to huggingface.co. The
 * UI surface (NarrationPreview) tells the user this before triggering it
 * so they can opt out by staying on a system voice instead.
 */

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX';

// Two configs we ship, in priority order:
//   1. webgpu + fp32 — fastest synthesis (~1 s/sentence) when the user's
//      browser has a working WebGPU adapter. Pays a bigger one-time
//      download (~80 MB instead of 20 MB) but it's cached afterward.
//   2. wasm + q8     — universally correct fallback. ~3× slower but only
//      ~20 MB, runs on every browser including Safari + Firefox.
//
// We tried `webgpu + q8` as the "best of both worlds" — it's broken.
// The kokoro-82M model at q8, run through Transformers.js's WebGPU EP
// on certain adapters, produces Chinese-sounding audio for English IPA
// input. Verified on macOS 2026-05-23 (the phonemes go in correct, the
// speaker comes out wrong-language). Keep this combo out of the
// candidate list until a future kokoro release fixes it.
type DType = 'fp32' | 'q8';
const CANDIDATES: ReadonlyArray<{ device: 'webgpu' | 'wasm'; dtype: DType }> = [
  { device: 'webgpu', dtype: 'fp32' },
  { device: 'wasm',   dtype: 'q8'   },
];

let cached: KokoroTTS | null = null;
let loading: Promise<KokoroTTS> | null = null;
let usingDevice: 'webgpu' | 'wasm' | 'unknown' = 'unknown';

/**
 * Probe whether the current browser exposes a working WebGPU adapter.
 * Just having `navigator.gpu` defined isn't enough — Firefox stubs it
 * but the adapter request fails. We commit to webgpu only if an adapter
 * actually comes back.
 */
async function detectWebGPU(): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nav = navigator as any;
  if (!nav.gpu) return false;
  try {
    const adapter = await nav.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export interface LoadOptions {
  /** Optional progress callback. Receives 0..1 values as the model
   *  weights stream in from HF Hub. Fires repeatedly during the first
   *  load; called once with 1 from cache on subsequent loads. */
  onProgress?: (p: number) => void;
}

/**
 * Load the kokoro pipeline, fetching the model from HF Hub on first call.
 * Returns the cached instance on every subsequent call.
 */
export async function getKokoro(opts: LoadOptions = {}): Promise<KokoroTTS> {
  if (cached) {
    opts.onProgress?.(1);
    return cached;
  }
  if (loading) return loading;

  loading = (async () => {
    const { KokoroTTS } = await import('kokoro-js');
    const progress_callback = (info: { status: string; progress?: number }) => {
      if (typeof info.progress === 'number') {
        opts.onProgress?.(Math.max(0, Math.min(1, info.progress / 100)));
      }
    };
    const hasGPU = await detectWebGPU();
    let tts: KokoroTTS | null = null;
    let lastError: unknown = null;
    for (const cand of CANDIDATES) {
      if (cand.device === 'webgpu' && !hasGPU) continue;
      try {
        tts = await KokoroTTS.from_pretrained(MODEL_ID, {
          dtype: cand.dtype,
          device: cand.device,
          progress_callback,
        });
        usingDevice = cand.device;
        break;
      } catch (e) {
        lastError = e;
        // Try the next candidate. WebGPU init can fail mid-load on some
        // hardware that nevertheless claimed an adapter.
        continue;
      }
    }
    if (!tts) {
      loading = null;
      throw lastError ?? new Error('Failed to initialize kokoro on any backend');
    }
    cached = tts;
    loading = null;
    return tts;
  })();

  return loading;
}

export interface SynthesisOptions {
  /** Voice ID — one of the kokoro voice catalog ids, e.g. `af_heart`. */
  voice: string;
  /** Speaking rate, 1 = default. The plan calls for 0.95 so dense chess
   *  prose lands clearly. */
  speed?: number;
}

export interface SynthesisResult {
  /** Raw PCM samples — useful for Web Audio buffer source nodes. */
  samples: Float32Array;
  /** Sample rate of `samples`. Kokoro outputs 24 kHz at the moment. */
  sampleRate: number;
  /** WAV blob — useful for direct playback via `<audio>` or for handing
   *  to ffmpeg via Blob → File. */
  blob: Blob;
}

/**
 * Synthesize a chunk of text to audio. Caller is responsible for waiting
 * (or chaining) — kokoro generates the full clip synchronously-ish (it
 * blocks the worker thread the model runs on, not the UI thread), so a
 * 20-line narration produces 20 sequential calls each of ~few seconds.
 */
export async function synthesize(
  text: string,
  opts: SynthesisOptions,
): Promise<SynthesisResult> {
  const tts = await getKokoro();
  // The kokoro types use `keyof VOICES` for voice; we accept a plain
  // string and let kokoro throw if it's not a valid id. The picker UI
  // only surfaces valid ones, so this is a safety net not a normal path.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await tts.generate(text, { voice: opts.voice as any, speed: opts.speed ?? 0.95 });
  return {
    samples: result.audio as Float32Array,
    sampleRate: result.sampling_rate,
    blob: result.toBlob(),
  };
}

/** A curated subset of kokoro voices we surface in the picker — the
 *  full catalog is 54 voices across 10 languages, way more than a chess
 *  app needs. These are the highest-quality English-language voices. */
export interface PickerVoice {
  id: string;
  label: string;
  lang: 'en-US' | 'en-GB';
  gender: 'female' | 'male';
}

export const KOKORO_PICKER: PickerVoice[] = [
  { id: 'af_heart',   label: 'Heart (American, female)',    lang: 'en-US', gender: 'female' },
  { id: 'af_bella',   label: 'Bella (American, female)',    lang: 'en-US', gender: 'female' },
  { id: 'af_nicole',  label: 'Nicole (American, female)',   lang: 'en-US', gender: 'female' },
  { id: 'am_michael', label: 'Michael (American, male)',    lang: 'en-US', gender: 'male'   },
  { id: 'am_onyx',    label: 'Onyx (American, male)',       lang: 'en-US', gender: 'male'   },
  { id: 'bf_emma',    label: 'Emma (British, female)',      lang: 'en-GB', gender: 'female' },
  { id: 'bm_george',  label: 'George (British, male)',      lang: 'en-GB', gender: 'male'   },
];

/** Is kokoro already loaded (no download needed)? */
export function isKokoroLoaded(): boolean {
  return cached !== null;
}

/** Which device kokoro is currently running on. Useful for UI hints — a
 *  "running on WebGPU" badge reassures users seeing fast synthesis that
 *  they're on the fast path. */
export function kokoroDevice(): 'webgpu' | 'wasm' | 'unknown' {
  return usingDevice;
}
