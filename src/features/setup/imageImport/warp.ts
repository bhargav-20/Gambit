import type { BoardQuad } from './types';
import { computeHomography, applyHomography } from './homography';

/**
 * Perspective-correct the board region of a source image into a flat,
 * axis-aligned canvas of size `size`×`size`. Each pixel in the destination
 * is sampled from the source via inverse mapping (a 4-point homography
 * from the destination's corners to the source quad's corners) + bilinear
 * interpolation.
 *
 * After warping, the rest of the classifier pipeline can pretend the board
 * was axis-aligned to begin with — extractSquare slices a 60×60 region
 * per square (at size=480), no homography awareness required.
 *
 * Cost: O(size²) pixel writes, each a ~10-op homography apply + 4-tap
 * bilinear sample. 480² ≈ 230k pixels — typically ~10-30 ms on a modern
 * laptop, fast enough to run on every corner-drag.
 *
 * If the quad is already axis-aligned (which is the v1 auto-detect output
 * for screenshots), the math still works — the homography degenerates
 * gracefully to an affine, and the result is equivalent to drawImage
 * with a rectangular source slice.
 */
export function warpBoard(
  source: HTMLImageElement | HTMLCanvasElement,
  quad: BoardQuad,
  size = 480,
): HTMLCanvasElement {
  // Inverse homography: maps each destination pixel back to its source
  // pixel. We define the destination as the unit-ish square [0,size]² with
  // corners in TL, TR, BR, BL order.
  const dstCorners = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  const srcCorners = [quad.tl, quad.tr, quad.br, quad.bl];
  const Hinv = computeHomography(dstCorners, srcCorners);

  // Pull source pixels into a typed array once. We can't call
  // ctx.drawImage with a perspective transform; Canvas 2D only supports
  // affine. So this is an explicit per-pixel inverse-mapping loop.
  const srcCanvas = ensureCanvas(source);
  const srcCtx = srcCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('warpBoard: no 2D context for source canvas');
  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;
  const srcImg = srcCtx.getImageData(0, 0, srcW, srcH);
  const src = srcImg.data;

  const dest = document.createElement('canvas');
  dest.width = dest.height = size;
  const destCtx = dest.getContext('2d');
  if (!destCtx) throw new Error('warpBoard: no 2D context for dest canvas');
  const destImg = destCtx.createImageData(size, size);
  const dst = destImg.data;

  // Hoist the homography matrix into locals so the per-pixel apply doesn't
  // pay an indexed-array-read cost in the inner loop.
  const h0 = Hinv[0], h1 = Hinv[1], h2 = Hinv[2];
  const h3 = Hinv[3], h4 = Hinv[4], h5 = Hinv[5];
  const h6 = Hinv[6], h7 = Hinv[7], h8 = Hinv[8];

  let outIdx = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Inline applyHomography for speed.
      const w = h6 * x + h7 * y + h8;
      const sx = (h0 * x + h1 * y + h2) / w;
      const sy = (h3 * x + h4 * y + h5) / w;

      // Bilinear sample. Falls back to opaque black if the projected
      // point lands outside the source image (which can happen if the
      // user drags a corner past the image edge — defensive, not common).
      if (sx < 0 || sx >= srcW - 1 || sy < 0 || sy >= srcH - 1) {
        dst[outIdx] = 0;
        dst[outIdx + 1] = 0;
        dst[outIdx + 2] = 0;
        dst[outIdx + 3] = 255;
      } else {
        const x0 = sx | 0;
        const y0 = sy | 0;
        const dx = sx - x0;
        const dy = sy - y0;
        const i00 = (y0 * srcW + x0) * 4;
        const i10 = i00 + 4;
        const i01 = i00 + srcW * 4;
        const i11 = i01 + 4;
        const wA = (1 - dx) * (1 - dy);
        const wB = dx * (1 - dy);
        const wC = (1 - dx) * dy;
        const wD = dx * dy;
        dst[outIdx]     = src[i00] * wA + src[i10] * wB + src[i01] * wC + src[i11] * wD;
        dst[outIdx + 1] = src[i00 + 1] * wA + src[i10 + 1] * wB + src[i01 + 1] * wC + src[i11 + 1] * wD;
        dst[outIdx + 2] = src[i00 + 2] * wA + src[i10 + 2] * wB + src[i01 + 2] * wC + src[i11 + 2] * wD;
        dst[outIdx + 3] = 255;
      }
      outIdx += 4;
    }
  }
  destCtx.putImageData(destImg, 0, 0);
  return dest;
}

/** Ensure the input is on a canvas (drawing an HTMLImageElement once if needed). */
function ensureCanvas(source: HTMLImageElement | HTMLCanvasElement): HTMLCanvasElement {
  if (source instanceof HTMLCanvasElement) return source;
  const c = document.createElement('canvas');
  c.width = source.naturalWidth;
  c.height = source.naturalHeight;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('ensureCanvas: no 2D context');
  ctx.drawImage(source, 0, 0);
  return c;
}

/**
 * Project a single source-image point into destination (warped board)
 * coordinates. Useful for the modal's overlay layer: given a cell's
 * center in destination space, find the source-image pixel where the
 * glyph should be drawn.
 *
 * For Shatran's UI we actually want the inverse direction (dest → source)
 * since the glyph positions are computed in dest space and rendered over
 * the source image. Export `quadToDestHomography` so callers can build
 * the right matrix for whichever direction they need.
 */
export function quadToDestHomography(quad: BoardQuad, size = 480) {
  // Maps source (image) → destination (axis-aligned warped board).
  const srcCorners = [quad.tl, quad.tr, quad.br, quad.bl];
  const dstCorners = [
    { x: 0, y: 0 },
    { x: size, y: 0 },
    { x: size, y: size },
    { x: 0, y: size },
  ];
  return computeHomography(srcCorners, dstCorners);
}

/** Forward-project a dest-space point to source-image coords via the quad. */
export function destToSource(quad: BoardQuad, dest: { x: number; y: number }, size = 480) {
  const Hinv = computeHomography(
    [
      { x: 0, y: 0 },
      { x: size, y: 0 },
      { x: size, y: size },
      { x: 0, y: size },
    ],
    [quad.tl, quad.tr, quad.br, quad.bl],
  );
  return applyHomography(Hinv, dest);
}
