import type { FenPiece } from '@/core/store/setupStore';
import { PIECE_SETS, type PieceCode } from '@/features/themes/piecesets';
import type { BoardQuad, DetectedGrid, ClassificationResult } from './types';
import { autoOrient, flip180 } from './orient';

/**
 * Per-square piece classifier.
 *
 * For each of the 64 squares carved out of the source image (via the
 * BoardQuad), we ask three questions, in order:
 *
 *   1. Is the square OCCUPIED? — high intensity variance vs the expected
 *      flat color of an empty square.
 *   2. If occupied, is the piece WHITE or BLACK? — look at the body pixels
 *      (the non-background fraction) and decide whether they're closer to
 *      "ink" (black piece) or "highlight" (white piece). This is robust
 *      across most web piece sets even when the exact glyph differs.
 *   3. Which piece KIND? — template-match against every shipped piece-set
 *      SVG at the same size, take the best score across all sets. Using
 *      the union of our piece sets (Cburnett, Merida, Alpha, Staunty, ...)
 *      means we match decently regardless of which set the source uses.
 *
 * Output is a `(FenPiece | null)[][]` indexed `[rank][file]` where rank 0
 * is the 8th rank (image-top) and file 0 is the a-file (image-left). The
 * orientation question (white at the bottom vs flipped) is the caller's
 * concern — auto-orientation is a worth-doing v2 upgrade.
 */

/** Working size we slice each square down to before matching. Bigger =
 *  better accuracy but quadratically more compute per square. 48 strikes a
 *  decent balance and keeps a full 64-square pass under ~200 ms. */
const SQUARE_SIZE = 48;

/** Piece codes we'll test against, in canonical order. */
const PIECE_KINDS = ['K', 'Q', 'R', 'B', 'N', 'P'] as const;
type PieceKind = (typeof PIECE_KINDS)[number];

/**
 * Lazy template cache. Templates are stored as raw greyscale bytes plus a
 * matching alpha mask (the piece's silhouette) so the matcher can ignore
 * background pixels when comparing. We render once per (setId, color, kind)
 * triple — typically ~132 templates total — and reuse for every square.
 */
interface Template {
  gray: Uint8ClampedArray;
  /** 0 = background, 1 = inside-the-piece. Same shape as gray. */
  alpha: Uint8Array;
  kind: PieceKind;
  color: 'w' | 'b';
  /** Pre-computed shape features so classify() doesn't recompute these
   *  for every template × every square (132 templates × 64 squares would
   *  otherwise mean ~8k redundant computes). */
  centroid: number;
  bboxHeight: number;
}

let templateCache: Template[] | null = null;

function svgToImage(svg: string): Promise<HTMLImageElement> {
  // The piece sets ship raw SVG text. Wrapping in a data URI gives us a
  // plain <img> we can drawImage() onto a canvas at any size.
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to render piece SVG'));
    img.src = url;
  });
}

async function buildTemplate(svg: string, kind: PieceKind, color: 'w' | 'b'): Promise<Template> {
  const img = await svgToImage(svg);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SQUARE_SIZE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('No 2D context for template canvas');
  // Most piece SVGs viewBox a bit wider than tall to leave breathing room;
  // chessground also pads them visually in-square. Draw at full size and
  // accept the slight padding — it matches what most renderers do.
  ctx.drawImage(img, 0, 0, SQUARE_SIZE, SQUARE_SIZE);
  const data = ctx.getImageData(0, 0, SQUARE_SIZE, SQUARE_SIZE).data;
  const N = SQUARE_SIZE * SQUARE_SIZE;
  const gray = new Uint8ClampedArray(N);
  const alpha = new Uint8Array(N);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const a = data[i + 3];
    alpha[p] = a > 16 ? 1 : 0; // anti-aliased edges still count as silhouette
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return {
    gray,
    alpha,
    kind,
    color,
    centroid: verticalCentroid(alpha),
    bboxHeight: bboxHeight(alpha),
  };
}

/** Render every shipped piece SVG to a normalized template. Cached so a
 *  second classification run reuses the same canvases. */
async function getTemplates(): Promise<Template[]> {
  if (templateCache) return templateCache;
  const pending: Promise<Template>[] = [];
  for (const set of PIECE_SETS) {
    for (const kind of PIECE_KINDS) {
      pending.push(buildTemplate(set.pieces[`w${kind}` as PieceCode], kind, 'w'));
      pending.push(buildTemplate(set.pieces[`b${kind}` as PieceCode], kind, 'b'));
    }
  }
  templateCache = await Promise.all(pending);
  return templateCache;
}

/** Extract a single square from the source image. v1 assumes the quad is
 *  axis-aligned (a rect), which is true for our auto-detect output. Photos
 *  with perspective would need a real homography here. */
function extractSquare(
  ctx: CanvasRenderingContext2D,
  quad: BoardQuad,
  rank: number,
  file: number,
): ImageData {
  const w = quad.tr.x - quad.tl.x;
  const h = quad.bl.y - quad.tl.y;
  const sqW = w / 8, sqH = h / 8;
  const sx = quad.tl.x + file * sqW;
  const sy = quad.tl.y + rank * sqH;
  // Resample to SQUARE_SIZE on an intermediate canvas to normalize for the
  // template comparison.
  const tmp = document.createElement('canvas');
  tmp.width = tmp.height = SQUARE_SIZE;
  const tmpCtx = tmp.getContext('2d', { willReadFrequently: true });
  if (!tmpCtx) throw new Error('No 2D context');
  // Source-canvas slice → resized square.
  tmpCtx.drawImage(
    ctx.canvas,
    sx, sy, sqW, sqH,
    0, 0, SQUARE_SIZE, SQUARE_SIZE,
  );
  return tmpCtx.getImageData(0, 0, SQUARE_SIZE, SQUARE_SIZE);
}

/** Per-pixel luma for an ImageData, packed into a Uint8ClampedArray of
 *  length width*height. Done once per square so subsequent passes (median,
 *  silhouette extraction, color decision) all read from the same buffer. */
function lumaBuffer(img: ImageData): Uint8ClampedArray {
  const N = img.data.length / 4;
  const out = new Uint8ClampedArray(N);
  const data = img.data;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    out[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }
  return out;
}

/** Median luma — robust estimator of the square's background color, since
 *  for any plausible position the majority of pixels in a square ARE the
 *  square's base color (the piece occupies the minority). */
function median(buf: Uint8ClampedArray): number {
  // Bucket sort across 256 luma bins — O(n) and avoids a full sort.
  const hist = new Uint32Array(256);
  for (let i = 0; i < buf.length; i++) hist[buf[i]]++;
  const target = buf.length / 2;
  let acc = 0;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= target) return v;
  }
  return 128;
}

/** Mean luma — only used for diagnostics. */
function meanLuma(buf: Uint8ClampedArray): number {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i];
  return s / buf.length;
}

/**
 * Extract a binary "piece silhouette" mask from a square's luma buffer.
 * Pixels that are far enough from the square's median (the background
 * color) are marked 1 = piece, others 0 = background. We compare against
 * the median rather than a hardcoded threshold so this works on any board
 * theme — Lichess green, Chess.com brown, dark themes, etc.
 *
 * The `delta` is how far from the median a pixel has to be to count. 28
 * was picked empirically across our shipped piece sets: high enough to
 * ignore anti-aliased edges of the square itself, low enough to capture
 * the piece's outline pixels (which can be only a shade darker than the
 * background on dark squares for black pieces).
 */
function silhouetteMask(luma: Uint8ClampedArray, med: number, delta = 28): Uint8Array {
  const out = new Uint8Array(luma.length);
  for (let i = 0; i < luma.length; i++) {
    if (Math.abs(luma[i] - med) > delta) out[i] = 1;
  }
  return out;
}

/**
 * Decide piece color from the silhouette. Among pixels marked "piece",
 * count those that are LIGHTER vs DARKER than the median. A white piece's
 * body and fill dominate the silhouette in the "lighter" bucket; a black
 * piece in the "darker" bucket. Outlines exist for both but are typically
 * a minority of silhouette pixels (the body and fill are most of the
 * piece), so the dominant bucket wins.
 */
function classifyColor(luma: Uint8ClampedArray, silhouette: Uint8Array, med: number): 'w' | 'b' {
  let lighter = 0, darker = 0;
  for (let i = 0; i < silhouette.length; i++) {
    if (!silhouette[i]) continue;
    if (luma[i] > med) lighter++;
    else if (luma[i] < med) darker++;
  }
  return lighter > darker ? 'w' : 'b';
}

/**
 * IoU between two binary silhouettes. 1 = identical shape, 0 = disjoint.
 * Robust against the specific square color and anti-aliasing differences
 * between how the template was rendered and how the source image was
 * drawn. Used as one component of the kind-classifier score; on its own
 * it's not enough to disambiguate (queens, kings, and bishops have
 * similar coarse silhouettes from this viewing angle).
 */
function silhouetteIou(a: Uint8Array, b: Uint8Array): number {
  let inter = 0, union = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i], bi = b[i];
    if (ai | bi) {
      union++;
      if (ai & bi) inter++;
    }
  }
  return union === 0 ? 0 : inter / union;
}

/**
 * Vertical center of mass of a binary silhouette, normalized to 0..1
 * (0 = piece is hugging the top of the square, 1 = bottom). Pawns are
 * bottom-heavy (low body, small top); kings/queens are vertically
 * centered. Cheap but surprisingly discriminating in practice.
 */
function verticalCentroid(sil: Uint8Array): number {
  let sum = 0, count = 0;
  for (let y = 0; y < SQUARE_SIZE; y++) {
    for (let x = 0; x < SQUARE_SIZE; x++) {
      if (sil[y * SQUARE_SIZE + x]) {
        sum += y;
        count++;
      }
    }
  }
  return count === 0 ? 0.5 : sum / (count * SQUARE_SIZE);
}

/**
 * Bounding-box height of the silhouette, normalized to 0..1. Pawns are
 * SHORT, kings/queens are tall, bishops/rooks somewhere between.
 * Complements verticalCentroid: a short piece centered near the bottom
 * is a pawn; a tall piece is a major piece.
 */
function bboxHeight(sil: Uint8Array): number {
  let yMin = SQUARE_SIZE, yMax = -1;
  for (let y = 0; y < SQUARE_SIZE; y++) {
    let rowAny = false;
    for (let x = 0; x < SQUARE_SIZE; x++) {
      if (sil[y * SQUARE_SIZE + x]) { rowAny = true; break; }
    }
    if (rowAny) {
      if (y < yMin) yMin = y;
      yMax = y;
    }
  }
  if (yMax < 0) return 0;
  return (yMax - yMin + 1) / SQUARE_SIZE;
}

/**
 * Combined score between a square silhouette and a template silhouette.
 * IoU is the main signal; we boost it by penalizing big differences in
 * vertical centroid and bbox height — those features distinguish pawns
 * from majors and minors much more reliably than silhouette overlap on
 * its own. Returns 0..1 where higher = better match.
 */
function combinedScore(
  squareSil: Uint8Array,
  templateSil: Uint8Array,
  squareCentroid: number,
  templateCentroid: number,
  squareBbox: number,
  templateBbox: number,
): number {
  const iou = silhouetteIou(squareSil, templateSil);
  const centroidPenalty = Math.abs(squareCentroid - templateCentroid);
  const heightPenalty = Math.abs(squareBbox - templateBbox);
  // Subtract penalties from the IoU. Coefficients tuned empirically: the
  // centroid coefficient is larger because it has a bigger discriminative
  // range (pawns at 0.65 vs kings at 0.55 is a clear gap).
  return Math.max(0, iou - centroidPenalty * 1.2 - heightPenalty * 0.6);
}

export async function classifyBoard(
  source: HTMLCanvasElement | HTMLImageElement,
  quad: BoardQuad,
): Promise<ClassificationResult> {
  // Render the source into a working canvas so we can extractImageData
  // from it. If `source` is already a canvas with willReadFrequently set
  // this is a no-op; otherwise it's a one-time copy.
  const sourceCanvas = document.createElement('canvas');
  const srcW = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const srcH = 'naturalHeight' in source ? source.naturalHeight : source.height;
  sourceCanvas.width = srcW;
  sourceCanvas.height = srcH;
  const srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!srcCtx) throw new Error('No 2D context for classify source');
  srcCtx.drawImage(source, 0, 0);

  const templates = await getTemplates();
  const N = SQUARE_SIZE * SQUARE_SIZE;

  // First pass: extract every square + compute luma buffer + silhouette
  // size. We need the global distribution of silhouette pixel counts to
  // tell occupied from empty squares — a fixed threshold doesn't work
  // across board themes.
  type SquareCtx = {
    luma: Uint8ClampedArray;
    median: number;
    silhouette: Uint8Array;
    pieceFraction: number;
    centroid: number;
    bbox: number;
  };
  const squares: SquareCtx[] = [];
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const sq = extractSquare(srcCtx, quad, rank, file);
      const luma = lumaBuffer(sq);
      const med = median(luma);
      const sil = silhouetteMask(luma, med);
      let pieceCount = 0;
      for (let i = 0; i < sil.length; i++) if (sil[i]) pieceCount++;
      squares.push({
        luma,
        median: med,
        silhouette: sil,
        pieceFraction: pieceCount / N,
        centroid: verticalCentroid(sil),
        bbox: bboxHeight(sil),
      });
    }
  }

  // Empty-square threshold: any board has at least 16 empty squares (the
  // 4 middle ranks in a fresh position; usually more). The bottom quartile
  // of pieceFraction values is a safe estimate of "what an empty square's
  // residual silhouette looks like" (anti-aliasing of square edges,
  // gradient noise, last-move highlights). Anything more than the empty
  // baseline + a margin = occupied.
  const sortedFrac = squares.map((s) => s.pieceFraction).sort((a, b) => a - b);
  const emptyBaseline = sortedFrac[Math.floor(sortedFrac.length * 0.25)];
  const occupiedFloor = Math.max(emptyBaseline + 0.03, 0.05);

  const grid: DetectedGrid = [];
  const confidence: number[][] = [];
  for (let rank = 0; rank < 8; rank++) {
    const gridRow: (FenPiece | null)[] = [];
    const confRow: number[] = [];
    for (let file = 0; file < 8; file++) {
      const sq = squares[rank * 8 + file];
      if (sq.pieceFraction < occupiedFloor) {
        gridRow.push(null);
        confRow.push(1 - sq.pieceFraction / occupiedFloor);
        continue;
      }
      const color = classifyColor(sq.luma, sq.silhouette, sq.median);
      // Match against every same-color template using the combined score
      // (silhouette IoU + centroid + bbox-height match). Templates from
      // every shipped piece set are candidates so the matcher isn't tied
      // to one specific style.
      let best: { kind: PieceKind; score: number } | null = null;
      let secondBest = 0;
      for (const t of templates) {
        if (t.color !== color) continue;
        const score = combinedScore(
          sq.silhouette, t.alpha,
          sq.centroid, t.centroid,
          sq.bbox, t.bboxHeight,
        );
        if (best === null || score > best.score) {
          if (best) secondBest = Math.max(secondBest, best.score);
          best = { kind: t.kind, score };
        } else if (score > secondBest) {
          secondBest = score;
        }
      }
      if (!best || best.score < 0.1) {
        // Nothing overlapped meaningfully — flag as empty rather than
        // planting a wrong piece. Better to under-detect than to lie.
        gridRow.push(null);
        confRow.push(0.2);
        continue;
      }
      const fenChar = color === 'w' ? best.kind : best.kind.toLowerCase();
      gridRow.push(fenChar as FenPiece);
      const margin = best.score - secondBest;
      confRow.push(Math.max(0, Math.min(1, margin * 5 + best.score * 0.5)));
    }
    grid.push(gridRow);
    confidence.push(confRow);
  }

  // meanLuma is exported so callers/diagnostics can reuse it — suppress
  // unused-symbol noise without dropping it from the API surface.
  void meanLuma;

  // Decide whether the IMAGE is likely viewed from Black's POV. We don't
  // actually rotate the grid here — the modal needs glyphs to overlay the
  // image as the user sees it, so display stays image-aligned and the
  // flip is applied later, on Apply (or when the user toggles it off).
  const oriented = autoOrient(grid);
  return { grid, confidence, suggestedFlip: oriented.flipped };
}

// flip180 is re-exported for the modal's manual Flip + apply-time rotation.
export { flip180 };

/** Serialize a detected grid to a piece-placement FEN string (no side-to-
 *  move / castling / etc — those parts are the caller's). */
export function gridToFenPiecePart(grid: DetectedGrid): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const p = grid[r][f];
      if (!p) {
        empty++;
      } else {
        if (empty > 0) { row += String(empty); empty = 0; }
        row += p;
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

/** Pre-warm the template cache. The caller can call this when the modal
 *  opens so the first detection run doesn't include the SVG-decode delay. */
export function preloadTemplates(): Promise<void> {
  return getTemplates().then(() => undefined);
}
