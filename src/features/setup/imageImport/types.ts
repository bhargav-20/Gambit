import type { FenPiece } from '@/core/store/setupStore';

/** Pixel coordinate in the source image. */
export interface Point {
  x: number;
  y: number;
}

/** Four corners of the board quad in source-image pixels, in the order
 *  top-left, top-right, bottom-right, bottom-left. Axis-aligned for v1 so
 *  the quad is really a rect; the 4-corner shape leaves room for true
 *  perspective unwarping later. */
export interface BoardQuad {
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

/** Detected piece per square, indexed as `grid[rank][file]`:
 *   rank 0 = the 8th rank (top of the board image when viewing from white).
 *   file 0 = a-file (left of the board image).
 *  null = empty square. */
export type DetectedGrid = (FenPiece | null)[][];

/** Output of the classification pass — pieces + a confidence-ish score per
 *  square so the UI can flag low-confidence cells. */
export interface ClassificationResult {
  grid: DetectedGrid;
  /** Same shape as grid; values in 0..1 where higher = more confident. */
  confidence: number[][];
}
