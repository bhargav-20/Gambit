import type { BoardQuad, Point } from './types';

/**
 * Auto-detect the chessboard region inside an arbitrary image.
 *
 * Approach (axis-aligned, v1):
 *   1. Downscale to a working resolution so per-pixel work stays fast.
 *   2. Convert to grayscale and compute Sobel gradient magnitude.
 *   3. Project gradient magnitude onto the X and Y axes (row sums, col sums).
 *      A chessboard's alternating-square interior generates a tight band of
 *      high gradient activity along both axes — the squares' edges.
 *   4. For each axis: smooth the projection, then find the longest contiguous
 *      run above a relative threshold. That run's start/end gives the bounding
 *      coordinates on that axis.
 *   5. Force the result to be square (chessboards are square) by centering on
 *      the smaller dimension of the two ranges. Falls back to a centered crop
 *      if the heuristic produced something nonsensical.
 *
 * True perspective unwarping (photographed boards seen from an angle) is a
 * deferred upgrade — the v1 quad has axis-aligned corners.
 */

const WORK_SIZE = 512;

export interface DetectionDebug {
  /** Internal working width/height (after downscale). */
  workW: number;
  workH: number;
  /** Smoothed gradient projections; same length as workW/workH. */
  rowProfile: number[];
  colProfile: number[];
}

export interface DetectionResult {
  quad: BoardQuad;
  /** Confidence in 0..1: how cleanly the projections singled out a square. */
  confidence: number;
  debug?: DetectionDebug;
}

/** Sample the image at WORK_SIZE×preserve-aspect via an offscreen canvas. */
function downscale(source: HTMLImageElement | HTMLCanvasElement): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; scale: number } {
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height;
  const scale = Math.min(WORK_SIZE / Math.max(srcW, srcH), 1);
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2D context for downscale canvas');
  ctx.drawImage(source, 0, 0, w, h);
  return { canvas, ctx, scale };
}

/** Greyscale luma in 0..255 from sRGB. */
function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Sobel gradient magnitude per pixel, returned as a flat Uint16 array of
 *  length w*h. We only need relative magnitudes, so we skip the divide. */
function sobel(gray: Uint8ClampedArray, w: number, h: number): Uint16Array {
  const out = new Uint16Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const tl = gray[i - w - 1], t = gray[i - w], tr = gray[i - w + 1];
      const l = gray[i - 1], r = gray[i + 1];
      const bl = gray[i + w - 1], b = gray[i + w], br = gray[i + w + 1];
      const gx = -tl - 2 * l - bl + tr + 2 * r + br;
      const gy = -tl - 2 * t - tr + bl + 2 * b + br;
      // Sum of abs is a fine cheap stand-in for sqrt(gx^2 + gy^2).
      out[i] = Math.min(65535, Math.abs(gx) + Math.abs(gy));
    }
  }
  return out;
}

/** Box-blur a 1D profile so single-pixel spikes don't dominate. */
function smooth1d(values: number[], radius: number): number[] {
  const n = values.length;
  const out = new Array<number>(n).fill(0);
  let acc = 0;
  for (let i = 0; i < Math.min(radius + 1, n); i++) acc += values[i];
  for (let i = 0; i < n; i++) {
    out[i] = acc;
    if (i + radius + 1 < n) acc += values[i + radius + 1];
    if (i - radius >= 0) acc -= values[i - radius];
  }
  // Normalize to the actual sliding-window width per index.
  for (let i = 0; i < n; i++) {
    const lo = Math.max(0, i - radius);
    const hi = Math.min(n - 1, i + radius);
    out[i] /= (hi - lo + 1);
  }
  return out;
}

/** Bounding-extent of indices where profile[i] >= threshold — the index of
 *  the first such i and the last. Returns null if nothing crosses the
 *  threshold. Used instead of "longest contiguous run" because small dips
 *  inside the board (e.g. a row of empty squares with low piece-edge
 *  contribution) shouldn't truncate the detected extent. */
function activeExtent(profile: number[], threshold: number): [number, number] | null {
  let lo = -1, hi = -1;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] >= threshold) {
      if (lo < 0) lo = i;
      hi = i;
    }
  }
  if (lo < 0) return null;
  return [lo, hi];
}

/** Build axis-aligned BoardQuad from a working-space rect, then scale back
 *  to source-image pixels. */
function quadFromRect(x0: number, y0: number, x1: number, y1: number, scale: number): BoardQuad {
  const inv = 1 / scale;
  const tl: Point = { x: x0 * inv, y: y0 * inv };
  const tr: Point = { x: x1 * inv, y: y0 * inv };
  const br: Point = { x: x1 * inv, y: y1 * inv };
  const bl: Point = { x: x0 * inv, y: y1 * inv };
  return { tl, tr, br, bl };
}

/** Centered square crop covering the whole working image, scaled back to
 *  source coords. Used when nothing was detected. */
function fallbackQuad(workW: number, workH: number, scale: number): BoardQuad {
  const side = Math.min(workW, workH);
  const x0 = (workW - side) / 2;
  const y0 = (workH - side) / 2;
  return quadFromRect(x0, y0, x0 + side, y0 + side, scale);
}

export function detectBoardQuad(source: HTMLImageElement | HTMLCanvasElement, withDebug = false): DetectionResult {
  const { canvas, ctx, scale } = downscale(source);
  const w = canvas.width, h = canvas.height;
  const img = ctx.getImageData(0, 0, w, h);

  // Pack greyscale into its own buffer so the Sobel loop stays cache-friendly.
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < img.data.length; i += 4, p++) {
    gray[p] = luma(img.data[i], img.data[i + 1], img.data[i + 2]);
  }
  const mag = sobel(gray, w, h);

  // Project gradient magnitude onto each axis. The squares' edges show up
  // as wide bands of high activity in both the row and column profiles —
  // the bounding box of the active region is (approximately) the board.
  const rowProf = new Array<number>(h).fill(0);
  const colProf = new Array<number>(w).fill(0);
  for (let y = 0; y < h; y++) {
    let row = 0;
    for (let x = 0; x < w; x++) {
      const v = mag[y * w + x];
      row += v;
      colProf[x] += v;
    }
    rowProf[y] = row;
  }

  // Smooth with a window that's a small fraction of the image's smaller
  // dimension — big enough to bridge the gaps between square edges, small
  // enough to keep the board boundary crisp.
  const smoothR = Math.max(2, Math.round(Math.min(w, h) / 64));
  const rs = smooth1d(rowProf, smoothR);
  const cs = smooth1d(colProf, smoothR);

  // Threshold low — 20% of peak — so a single row of empty squares inside
  // the board doesn't fall below it and chop the detected extent. The
  // bounding-extent approach (rather than longest-contiguous-run) tolerates
  // small dips inside the board too. The 20% floor was picked empirically:
  // higher (40%) misses the board's outer rows on dim-themed screenshots;
  // lower (10%) picks up scattered noise outside the board.
  const rPeak = rs.reduce((m, v) => Math.max(m, v), 0);
  const cPeak = cs.reduce((m, v) => Math.max(m, v), 0);
  const rThresh = rPeak * 0.2;
  const cThresh = cPeak * 0.2;

  const rExtent = activeExtent(rs, rThresh);
  const cExtent = activeExtent(cs, cThresh);

  if (!rExtent || !cExtent) {
    return { quad: fallbackQuad(w, h, scale), confidence: 0, debug: withDebug ? { workW: w, workH: h, rowProfile: rs, colProfile: cs } : undefined };
  }

  // Square-ify: chessboards are square. Take the LARGER detected dimension
  // (we'd rather keep extra space at the edges than lose actual squares),
  // and center it on the smaller axis. Then clamp into the image bounds
  // — if the resulting square wouldn't fit, fall back to fitting in the
  // smaller dimension.
  const rLen = rExtent[1] - rExtent[0] + 1;
  const cLen = cExtent[1] - cExtent[0] + 1;
  // Use the larger dimension as the target side, but cap at the image's
  // smaller dimension so we never end up off-canvas.
  const targetSide = Math.max(rLen, cLen);
  const side = Math.min(targetSide, Math.min(w, h));
  // Center on each axis's midpoint.
  const rMid = (rExtent[0] + rExtent[1]) / 2;
  const cMid = (cExtent[0] + cExtent[1]) / 2;
  let x0 = cMid - side / 2;
  let y0 = rMid - side / 2;
  // Clamp into the image so we don't end up off-canvas if the side is
  // larger than one of the original ranges (shouldn't happen with the min
  // above, but defensive).
  x0 = Math.max(0, Math.min(w - side, x0));
  y0 = Math.max(0, Math.min(h - side, y0));
  const x1 = x0 + side, y1 = y0 + side;

  // Confidence proxy: a real chessboard's gradient extent is close to
  // square AND fills a meaningful fraction of the image. Square-ness alone
  // isn't enough (random noise can look squarish); requiring decent size
  // weeds out tiny false-positives.
  const aspect = Math.min(rLen, cLen) / Math.max(rLen, cLen);
  const sizeFraction = side / Math.min(w, h);
  const confidence = Math.max(0, Math.min(1, aspect * sizeFraction));

  return {
    quad: quadFromRect(x0, y0, x1, y1, scale),
    confidence,
    debug: withDebug ? { workW: w, workH: h, rowProfile: rs, colProfile: cs } : undefined,
  };
}
