import type { Point } from './types';

/**
 * 4-point projective transform (homography).
 *
 * Computes a 3×3 matrix H such that for each i ∈ 0..3,
 *   (dst[i].x, dst[i].y, 1)ᵀ ∝ H · (src[i].x, src[i].y, 1)ᵀ
 *
 * We fix h33 = 1 (homographies are projectively scale-invariant) and solve
 * the remaining 8 unknowns from the 8 scalar equations (one per (x,y)
 * coord per point). Gaussian elimination — small, no dependencies.
 *
 * The matrix is returned as a flat 9-tuple in row-major order:
 *   [ h11, h12, h13,
 *     h21, h22, h23,
 *     h31, h32, h33=1 ]
 *
 * Throws on degenerate inputs (collinear / coincident points) where the
 * linear system is singular. The caller should guard against that — for
 * Shatran's image-import flow, a sensible quad always has 4 distinct
 * non-collinear corners.
 *
 * Why home-rolled instead of a library: the math is ~50 lines, the inputs
 * are 4-and-only-4 points, and we don't want a new dep for one use site.
 */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

export function computeHomography(src: Point[], dst: Point[]): Mat3 {
  if (src.length !== 4 || dst.length !== 4) {
    throw new Error('computeHomography needs exactly 4 source and 4 dest points');
  }

  // Build the 8×8 system A · h = b, with h = [h11,h12,h13,h21,h22,h23,h31,h32].
  // Per point (x,y) → (X,Y):
  //   X = h11·x + h12·y + h13 − X·h31·x − X·h32·y
  //   Y = h21·x + h22·y + h23 − Y·h31·x − Y·h32·y
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: X, y: Y } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.push(X);
    A.push([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.push(Y);
  }

  const h = solve8x8(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * Apply a homography to a single 2D point. Returns the transformed point
 * after the perspective divide (z normalization).
 */
export function applyHomography(H: Mat3, p: Point): Point {
  const x = H[0] * p.x + H[1] * p.y + H[2];
  const y = H[3] * p.x + H[4] * p.y + H[5];
  const w = H[6] * p.x + H[7] * p.y + H[8];
  return { x: x / w, y: y / w };
}

/**
 * Standard Gaussian elimination with partial pivoting on an 8×8 system.
 * Mutates A and b. Returns h ∈ ℝ⁸.
 */
function solve8x8(A: number[][], b: number[]): number[] {
  const n = 8;
  for (let i = 0; i < n; i++) {
    // Partial pivot: find max-|A[k][i]| over k ≥ i, swap row i with k.
    let maxRow = i;
    let maxAbs = Math.abs(A[i][i]);
    for (let k = i + 1; k < n; k++) {
      const a = Math.abs(A[k][i]);
      if (a > maxAbs) { maxAbs = a; maxRow = k; }
    }
    if (maxAbs < 1e-12) {
      throw new Error('computeHomography: singular system (degenerate quad)');
    }
    if (maxRow !== i) {
      [A[i], A[maxRow]] = [A[maxRow], A[i]];
      [b[i], b[maxRow]] = [b[maxRow], b[i]];
    }
    // Eliminate below
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / A[i][i];
      if (factor === 0) continue;
      for (let j = i; j < n; j++) A[k][j] -= factor * A[i][j];
      b[k] -= factor * b[i];
    }
  }
  // Back-substitute
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) sum -= A[i][j] * x[j];
    x[i] = sum / A[i][i];
  }
  return x;
}
