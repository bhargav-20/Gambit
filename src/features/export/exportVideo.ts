import type { LoadedGame } from '@/core/chess/types';
import type { BoardThemeId, PieceSetId } from '@/core/store/uiStore';
import { BoardRenderer, buildSnapshots } from './render';

export type Aspect = 'portrait' | 'landscape' | 'square';

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
 * Render a game to video via canvas + MediaRecorder. We drive the canvas frame
 * loop at real-time (no faster than the recorder consumes) so the resulting
 * file plays back at the same pace the user sees in preview.
 */
export async function exportGameToVideo(game: LoadedGame, opts: ExportOptions): Promise<ExportResult> {
  const { w, h } = DIMENSIONS[opts.aspect];
  const fps = opts.fps ?? 30;
  const animMs = opts.animMs ?? 350;
  const holdMs = opts.holdMs ?? 700;
  const introMs = opts.introMs ?? 800;
  const outroMs = opts.outroMs ?? 1200;

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
  const totalFrames = Math.ceil((totalMs / 1000) * fps);

  // Determine recorder mime
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
  renderer.drawFrame({ fen: game.initialFen });
  recorder.start(200);

  // Frame loop in real time using requestAnimationFrame so MediaRecorder samples cleanly.
  await new Promise<void>((resolve) => {
    const start = performance.now();
    let lastReportedFrame = -1;
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed >= totalMs) {
        // Final frame
        renderFor(elapsed);
        opts.onProgress?.(1);
        resolve();
        return;
      }
      renderFor(elapsed);
      const frame = Math.floor((elapsed / 1000) * fps);
      if (frame !== lastReportedFrame) {
        lastReportedFrame = frame;
        opts.onProgress?.(Math.min(0.999, frame / totalFrames));
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    function renderFor(elapsed: number) {
      // Intro: starting position, no last move
      if (elapsed < introMs) {
        renderer.drawFrame({ fen: game.initialFen });
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
      // Outro: last position held
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
        renderer.drawFrame({ fen: game.initialFen });
      }
    }
  });

  // Give MediaRecorder one tick to flush
  await new Promise((r) => setTimeout(r, 100));
  recorder.stop();
  const blob = await recorderDone;
  return { blob, mime: mime || 'video/webm', extension, durationMs: totalMs };
}
