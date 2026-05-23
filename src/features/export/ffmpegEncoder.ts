import type { FFmpeg } from '@ffmpeg/ffmpeg';

/**
 * Lazy-loaded ffmpeg.wasm wrapper. The core (~32 MB) only downloads on the
 * user's first high-quality export and is cached by the browser afterward.
 *
 * We host the single-threaded ESM build of ffmpeg-core under `public/ffmpeg/`
 * so it loads from the same origin without needing COOP/COEP headers (same
 * reasoning as the Stockfish setup — GH Pages can't set those).
 */

let cached: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

const FFMPEG_DIR = `${import.meta.env.BASE_URL}ffmpeg`;
const CORE_URL = `${FFMPEG_DIR}/ffmpeg-core.js`;
const WASM_URL = `${FFMPEG_DIR}/ffmpeg-core.wasm`;

/** Get a loaded ffmpeg instance, downloading the core on the first call. */
export async function getFfmpeg(): Promise<FFmpeg> {
  if (cached) return cached;
  if (loading) return loading;

  loading = (async () => {
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    const ff = new FFmpeg();

    // Vite's dev server refuses to dynamic-import files from `public/`
    // ("should not be imported from source code"), so we fetch the core script
    // ourselves and wrap it in a Blob URL. This sidesteps the module pipeline
    // entirely and works identically in dev and on GH Pages.
    const coreText = await fetch(CORE_URL).then((r) => {
      if (!r.ok) throw new Error(`ffmpeg-core.js fetch failed (${r.status})`);
      return r.text();
    });
    const coreBlobURL = URL.createObjectURL(new Blob([coreText], { type: 'text/javascript' }));

    await ff.load({ coreURL: coreBlobURL, wasmURL: WASM_URL });
    cached = ff;
    loading = null;
    return ff;
  })();

  return loading;
}

export interface EncodeOptions {
  fps: number;
  /** Called with 0..1 as ffmpeg reports progress. */
  onProgress?: (p: number) => void;
  /** Optional WAV audio that gets muxed alongside the video. When set the
   *  encoder switches to a two-input command and adds AAC audio at 128
   *  kbps. The audio must already be written to MEMFS as `audio.wav`
   *  before calling encodeFrames. */
  withAudio?: boolean;
}

/**
 * Encode a sequence of JPEG frames into an H.264 MP4. Frames must be written
 * to ffmpeg's MEMFS as `f00000.jpg`, `f00001.jpg`, ... before calling this.
 *
 * Uses libx264 with yuv420p (max compatibility) and `+faststart` so the moov
 * atom sits at the front of the file — needed for in-browser <video> playback
 * and for streaming sites.
 */
export async function encodeFrames(frameCount: number, opts: EncodeOptions): Promise<Uint8Array> {
  const ff = await getFfmpeg();

  let progressHandler: ((e: { progress: number }) => void) | null = null;
  if (opts.onProgress) {
    progressHandler = ({ progress }) => {
      // ffmpeg's progress can briefly exceed 1 at the end; clamp.
      opts.onProgress!(Math.max(0, Math.min(1, progress)));
    };
    ff.on('progress', progressHandler);
  }

  try {
    const args = [
      '-framerate', String(opts.fps),
      '-i', 'f%05d.jpg',
    ];
    if (opts.withAudio) {
      args.push('-i', 'audio.wav');
    }
    args.push(
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'veryfast',
      '-crf', '20',
    );
    if (opts.withAudio) {
      // AAC stereo at 128 kbps — wide compatibility. `-shortest` clips
      // to the video duration when the audio track is longer (e.g. a
      // music loop overshooting the last move).
      args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
    }
    args.push('-movflags', '+faststart', 'out.mp4');
    await ff.exec(args);

    const data = await ff.readFile('out.mp4');
    if (typeof data === 'string') throw new Error('ffmpeg returned text, expected binary');

    // Cleanup MEMFS so a second export doesn't accumulate frames.
    await ff.deleteFile('out.mp4').catch(() => {});
    if (opts.withAudio) await ff.deleteFile('audio.wav').catch(() => {});
    for (let i = 0; i < frameCount; i++) {
      const name = `f${String(i).padStart(5, '0')}.jpg`;
      await ff.deleteFile(name).catch(() => {});
    }

    return data;
  } finally {
    if (progressHandler) ff.off('progress', progressHandler);
  }
}
