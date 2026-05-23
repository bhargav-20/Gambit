import type { LoadedGame } from '@/core/chess/types';
import type { BoardThemeId, PieceSetId } from '@/core/store/uiStore';
import { BoardRenderer, buildSnapshots } from './render';
import type { TimedSnapshot } from './render';
import { encodeFrames, getFfmpeg } from './ffmpegEncoder';

export type Aspect = 'portrait' | 'landscape' | 'square';
export type Quality = 'fast' | 'high';

const DIMENSIONS: Record<Aspect, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1920 },
  landscape: { w: 1920, h: 1080 },
  square: { w: 1080, h: 1080 },
};

export interface ExportOptions {
  aspect: Aspect;
  themeId: BoardThemeId;
  pieceSetId: PieceSetId;
  orientation: 'white' | 'black';
  title?: string;
  subtitle?: string;
  fps?: number;             // default 30
  animMs?: number;          // per-move animation, default 350
  holdMs?: number;          // per-move hold after animation, default 700
  introMs?: number;         // initial pause showing the starting position
  outroMs?: number;         // tail pause on the final position
  /**
   * 'fast' (default) — MediaRecorder, real-time, WebM/MP4 best-effort.
   * 'high' — ffmpeg.wasm libx264 MP4, deterministic, plays everywhere.
   * High-quality is slower (~3–5× real-time) and downloads ~32 MB the first time.
   */
  quality?: Quality;
  onProgress?: (p: number) => void;
}

export interface ExportResult {
  blob: Blob;
  mime: string;
  extension: string;
  durationMs: number;
}

/**
 * Pick the best supported MediaRecorder mime type. Most browsers will provide
 * WebM here; MP4 is best-effort (works on recent Safari and some Chromiums).
 */
function pickMime(): { mime: string; extension: string } {
  const candidates: Array<{ mime: string; extension: string }> = [
    { mime: 'video/mp4;codecs=avc1.42E01E', extension: 'mp4' },
    { mime: 'video/webm;codecs=vp9', extension: 'webm' },
    { mime: 'video/webm;codecs=vp8', extension: 'webm' },
    { mime: 'video/webm', extension: 'webm' },
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c.mime)) return c;
  }
  return { mime: '', extension: 'webm' };
}

/**
 * Render the canvas for a given elapsed time, picking the right snapshot/anim
 * progress slice from the precomputed snapshot list. Shared between the
 * MediaRecorder real-time loop and the ffmpeg deterministic stepper.
 */
function renderAtElapsed(
  renderer: BoardRenderer,
  snapshots: TimedSnapshot[],
  initialFen: string,
  introMs: number,
  totalMs: number,
  elapsed: number,
) {
  if (elapsed < introMs) {
    renderer.drawFrame({ fen: initialFen });
    return;
  }
  let t = elapsed - introMs;
  for (const snap of snapshots) {
    const segment = snap.animDurationMs + snap.holdDurationMs;
    if (t < segment) {
      if (t < snap.animDurationMs) {
        const p = snap.animDurationMs === 0 ? 1 : t / snap.animDurationMs;
        renderer.drawFrame({
          fen: snap.fenAfter,
          animFromFen: snap.fenBefore,
          animProgress: p,
          lastMove: [snap.from, snap.to],
          moveSan: snap.san,
          moveNumber: snap.moveNumber,
          isWhite: snap.isWhite,
        });
      } else {
        renderer.drawFrame({
          fen: snap.fenAfter,
          lastMove: [snap.from, snap.to],
          moveSan: snap.san,
          moveNumber: snap.moveNumber,
          isWhite: snap.isWhite,
        });
      }
      return;
    }
    t -= segment;
  }
  // Past the last segment — outro frame.
  const lastSnap = snapshots[snapshots.length - 1];
  if (lastSnap) {
    renderer.drawFrame({
      fen: lastSnap.fenAfter,
      lastMove: [lastSnap.from, lastSnap.to],
      moveSan: lastSnap.san,
      moveNumber: lastSnap.moveNumber,
      isWhite: lastSnap.isWhite,
    });
  } else {
    renderer.drawFrame({ fen: initialFen });
  }
  // Reference `totalMs` to silence unused-arg warnings; callers pass it for
  // symmetry but the snapshot iteration already accounts for end-of-video.
  void totalMs;
}

function canvasToJpegBytes(canvas: HTMLCanvasElement, quality = 0.92): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('canvas.toBlob returned null')); return; }
        blob.arrayBuffer().then((buf) => resolve(new Uint8Array(buf))).catch(reject);
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Eagerly preload the ffmpeg core. Useful for a "Preload" button so the
 *  first export doesn't pay the 32 MB download cost mid-render. */
export function preloadFfmpeg() {
  return getFfmpeg();
}

/**
 * Render a game to video. Two backends:
 *   - 'fast': canvas + MediaRecorder real-time (default; produces WebM or MP4
 *     depending on browser support).
 *   - 'high': canvas frames → ffmpeg.wasm libx264 MP4 (deterministic, plays
 *     everywhere including Safari, ~3–5× real-time).
 */
export async function exportGameToVideo(game: LoadedGame, opts: ExportOptions): Promise<ExportResult> {
  const { w, h } = DIMENSIONS[opts.aspect];
  const fps = opts.fps ?? 30;
  const animMs = opts.animMs ?? 350;
  const holdMs = opts.holdMs ?? 700;
  const introMs = opts.introMs ?? 800;
  const outroMs = opts.outroMs ?? 1200;
  const quality = opts.quality ?? 'fast';

  const canvas = document.createElement('canvas');
  const renderer = new BoardRenderer(canvas, {
    width: w,
    height: h,
    themeId: opts.themeId,
    pieceSetId: opts.pieceSetId,
    orientation: opts.orientation,
    title: opts.title,
    subtitle: opts.subtitle,
  });
  await renderer.waitForAssets();

  const snapshots = buildSnapshots(game, animMs, holdMs);
  const totalMs = introMs + snapshots.reduce((acc, s) => acc + s.animDurationMs + s.holdDurationMs, 0) + outroMs;

  if (quality === 'high') {
    return exportViaFfmpeg(canvas, renderer, snapshots, game.initialFen, introMs, totalMs, fps, opts.onProgress);
  }
  return exportViaMediaRecorder(canvas, renderer, snapshots, game.initialFen, introMs, totalMs, fps, opts.onProgress);
}

async function exportViaMediaRecorder(
  canvas: HTMLCanvasElement,
  renderer: BoardRenderer,
  snapshots: TimedSnapshot[],
  initialFen: string,
  introMs: number,
  totalMs: number,
  fps: number,
  onProgress?: (p: number) => void,
): Promise<ExportResult> {
  const totalFrames = Math.ceil((totalMs / 1000) * fps);

  const { mime, extension } = pickMime();
  const stream = canvas.captureStream(fps);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };

  const recorderDone = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mime || 'video/webm' }));
    recorder.onerror = (e) => reject((e as ErrorEvent).error ?? new Error('recorder error'));
  });

  // Draw the initial frame BEFORE starting the recorder so the first capture is valid.
  renderer.drawFrame({ fen: initialFen });
  recorder.start(200);

  await new Promise<void>((resolve) => {
    const start = performance.now();
    let lastReportedFrame = -1;
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= totalMs) {
        renderAtElapsed(renderer, snapshots, initialFen, introMs, totalMs, elapsed);
        onProgress?.(1);
        resolve();
        return;
      }
      renderAtElapsed(renderer, snapshots, initialFen, introMs, totalMs, elapsed);
      const frame = Math.floor((elapsed / 1000) * fps);
      if (frame !== lastReportedFrame) {
        lastReportedFrame = frame;
        onProgress?.(Math.min(0.999, frame / totalFrames));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await new Promise((r) => setTimeout(r, 100));
  recorder.stop();
  const blob = await recorderDone;
  return { blob, mime: mime || 'video/webm', extension, durationMs: totalMs };
}

async function exportViaFfmpeg(
  canvas: HTMLCanvasElement,
  renderer: BoardRenderer,
  snapshots: TimedSnapshot[],
  initialFen: string,
  introMs: number,
  totalMs: number,
  fps: number,
  onProgress?: (p: number) => void,
): Promise<ExportResult> {
  const ff = await getFfmpeg();
  const totalFrames = Math.ceil((totalMs / 1000) * fps);
  const frameDurMs = 1000 / fps;

  // Phase 1 (0..0.7): render frames deterministically and write to MEMFS.
  for (let i = 0; i < totalFrames; i++) {
    const elapsed = i * frameDurMs;
    renderAtElapsed(renderer, snapshots, initialFen, introMs, totalMs, elapsed);
    const bytes = await canvasToJpegBytes(canvas, 0.92);
    const name = `f${String(i).padStart(5, '0')}.jpg`;
    await ff.writeFile(name, bytes);
    if (i % 4 === 0) onProgress?.((i / totalFrames) * 0.7);
    // Yield to the event loop occasionally so the UI stays responsive.
    if (i % 8 === 0) await new Promise<void>((r) => setTimeout(r, 0));
  }

  // Phase 2 (0.7..1.0): encode.
  const data = await encodeFrames(totalFrames, {
    fps,
    onProgress: (p) => onProgress?.(0.7 + p * 0.3),
  });
  onProgress?.(1);

  const blob = new Blob([data], { type: 'video/mp4' });
  return { blob, mime: 'video/mp4', extension: 'mp4', durationMs: totalMs };
}
