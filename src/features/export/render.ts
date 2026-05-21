import { Chess } from 'chess.js';
import type { LoadedGame, MoveStep } from '@/core/chess/types';
import { findBoardTheme } from '@/features/themes/boardThemes';
import type { BoardThemeId, PieceSetId } from '@/core/store/uiStore';
import { findPieceSet } from '@/features/themes/piecesets';
import type { PieceCode } from '@/features/themes/piecesets';

/**
 * Self-contained, dependency-free 2D board renderer used during video export.
 * Renders directly to a 2D canvas using bitmap-cached piece SVGs so frames are
 * deterministic and resolution-independent. Uses the same piece set as the
 * live board so videos look identical to the on-screen preview.
 */

interface PieceCache {
  bitmaps: Map<PieceCode, HTMLImageElement>;
  ready: Promise<void>;
}

function buildPieceCache(setId: PieceSetId): PieceCache {
  const set = findPieceSet(setId);
  const map = new Map<PieceCode, HTMLImageElement>();
  const promises: Promise<void>[] = [];
  for (const code of Object.keys(set.pieces) as PieceCode[]) {
    const img = new Image();
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(set.pieces[code])}`;
    promises.push(new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
      img.src = url;
    }));
    map.set(code, img);
  }
  return { bitmaps: map, ready: Promise.all(promises).then(() => undefined) };
}

const cacheBySet = new Map<string, PieceCache>();
function getPieceCache(setId: PieceSetId): PieceCache {
  let c = cacheBySet.get(setId);
  if (!c) { c = buildPieceCache(setId); cacheBySet.set(setId, c); }
  return c;
}

function fenCharToCode(c: string): PieceCode {
  const color = c === c.toUpperCase() ? 'w' : 'b';
  return `${color}${c.toUpperCase()}` as PieceCode;
}

// ---------- Frame renderer ----------

export interface RenderOptions {
  width: number;
  height: number;
  themeId: BoardThemeId;
  pieceSetId: PieceSetId;
  orientation: 'white' | 'black';
  title?: string;
  subtitle?: string;
  showMoveLabel?: boolean;
}

export interface RenderFrame {
  fen: string;
  moveSan?: string;
  lastMove?: [string, string];     // [from, to] squares
  moveNumber?: number;
  isWhite?: boolean;
  /** 0..1 interpolation toward the move's destination — used to animate pieces between snapshots. */
  animProgress?: number;
  animFromFen?: string;
}

function squareToXY(sq: string, orient: 'white' | 'black'): [number, number] {
  const file = sq.charCodeAt(0) - 'a'.charCodeAt(0); // 0..7
  const rank = parseInt(sq[1], 10) - 1;              // 0..7
  if (orient === 'white') return [file, 7 - rank];
  return [7 - file, rank];
}

function parseFenPieces(fen: string): Array<{ sq: string; code: PieceCode }> {
  const board = fen.split(' ')[0];
  const rows = board.split('/');
  const out: Array<{ sq: string; code: PieceCode }> = [];
  rows.forEach((row, ri) => {
    let file = 0;
    for (const c of row) {
      if (/\d/.test(c)) { file += parseInt(c, 10); continue; }
      const sq = String.fromCharCode('a'.charCodeAt(0) + file) + (8 - ri).toString();
      const code = fenCharToCode(c);
      out.push({ sq, code });
      file++;
    }
  });
  return out;
}

export class BoardRenderer {
  private ctx: CanvasRenderingContext2D;
  private opts: RenderOptions;
  private boardSize: number;
  private boardX: number;
  private boardY: number;
  private squareSize: number;

  constructor(canvas: HTMLCanvasElement, opts: RenderOptions) {
    this.opts = opts;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    this.ctx = ctx;
    canvas.width = opts.width;
    canvas.height = opts.height;

    // Reserve space for title (top) and caption (bottom) in portrait;
    // in landscape, board takes most of the height with side caption.
    const isPortrait = opts.height > opts.width;
    const padding = Math.round(opts.width * 0.06);
    if (isPortrait) {
      const reservedTop = Math.round(opts.height * 0.16);
      const reservedBottom = Math.round(opts.height * 0.16);
      this.boardSize = Math.min(opts.width - padding * 2, opts.height - reservedTop - reservedBottom);
      this.boardX = Math.round((opts.width - this.boardSize) / 2);
      this.boardY = reservedTop + Math.round(((opts.height - reservedTop - reservedBottom) - this.boardSize) / 2);
    } else {
      this.boardSize = Math.min(opts.height - padding * 2, opts.width * 0.66);
      this.boardX = padding;
      this.boardY = Math.round((opts.height - this.boardSize) / 2);
    }
    this.squareSize = this.boardSize / 8;
  }

  async waitForAssets() {
    await getPieceCache(this.opts.pieceSetId).ready;
  }

  drawFrame(frame: RenderFrame) {
    const { ctx } = this;
    const theme = findBoardTheme(this.opts.themeId);
    const isPortrait = this.opts.height > this.opts.width;

    // Background: deep panel
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, this.opts.width, this.opts.height);

    // Subtle radial accent
    const grad = ctx.createRadialGradient(
      this.opts.width * 0.5, this.opts.height * 0.1,
      0,
      this.opts.width * 0.5, this.opts.height * 0.1,
      this.opts.width * 0.8,
    );
    grad.addColorStop(0, 'rgba(233,180,101,0.10)');
    grad.addColorStop(1, 'rgba(11,13,18,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.opts.width, this.opts.height);

    // Board shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 16;
    ctx.fillStyle = theme.dark;
    ctx.fillRect(this.boardX - 2, this.boardY - 2, this.boardSize + 4, this.boardSize + 4);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Squares
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const isLight = (f + r) % 2 === 0;
        ctx.fillStyle = isLight ? theme.light : theme.dark;
        ctx.fillRect(
          this.boardX + f * this.squareSize,
          this.boardY + r * this.squareSize,
          this.squareSize,
          this.squareSize,
        );
      }
    }

    // Last-move highlight
    if (frame.lastMove) {
      ctx.fillStyle = theme.lastMove;
      for (const sq of frame.lastMove) {
        const [fx, fy] = squareToXY(sq, this.opts.orientation);
        ctx.fillRect(
          this.boardX + fx * this.squareSize,
          this.boardY + fy * this.squareSize,
          this.squareSize,
          this.squareSize,
        );
      }
    }

    // Coordinates
    ctx.fillStyle = theme.coordsColor;
    ctx.font = `${Math.max(10, this.squareSize * 0.18)}px Inter, sans-serif`;
    ctx.textBaseline = 'top';
    for (let i = 0; i < 8; i++) {
      const file = this.opts.orientation === 'white' ? i : 7 - i;
      const rank = this.opts.orientation === 'white' ? 7 - i : i;
      const fileChar = String.fromCharCode('a'.charCodeAt(0) + file);
      const rankChar = (8 - rank).toString();
      // File along bottom
      ctx.fillText(
        fileChar,
        this.boardX + i * this.squareSize + this.squareSize * 0.08,
        this.boardY + this.boardSize - this.squareSize * 0.22,
      );
      // Rank along left
      ctx.fillText(
        rankChar,
        this.boardX + this.squareSize * 0.08,
        this.boardY + i * this.squareSize + this.squareSize * 0.06,
      );
    }

    // Pieces — animate the moved piece if animProgress provided.
    const pieces = parseFenPieces(frame.fen);
    const animKey = (() => {
      if (frame.animProgress === undefined || !frame.lastMove || !frame.animFromFen) return null;
      return { from: frame.lastMove[0], to: frame.lastMove[1], progress: frame.animProgress };
    })();

    const beforePieces = animKey && frame.animFromFen ? parseFenPieces(frame.animFromFen) : null;

    if (animKey && beforePieces) {
      // Draw all pieces from BEFORE position, except the mover (which we interpolate).
      const moverBefore = beforePieces.find((p) => p.sq === animKey.from);
      const capturedBefore = beforePieces.find((p) => p.sq === animKey.to);
      void capturedBefore;
      for (const p of beforePieces) {
        if (p.sq === animKey.from) continue;
        if (p.sq === animKey.to) {
          // Fade the captured piece out
          this.drawPiece(p.sq, p.code, 1 - animKey.progress);
          continue;
        }
        this.drawPiece(p.sq, p.code, 1);
      }
      if (moverBefore) {
        const [fx0, fy0] = squareToXY(animKey.from, this.opts.orientation);
        const [fx1, fy1] = squareToXY(animKey.to, this.opts.orientation);
        const t = easeInOutCubic(animKey.progress);
        const fx = fx0 + (fx1 - fx0) * t;
        const fy = fy0 + (fy1 - fy0) * t;
        this.drawPieceAt(fx, fy, moverBefore.code, 1);
      }
    } else {
      for (const p of pieces) this.drawPiece(p.sq, p.code, 1);
    }

    // Titles / captions
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#e7e9ee';
    if (isPortrait) {
      // Top: title
      ctx.textBaseline = 'top';
      if (this.opts.title) {
        ctx.font = `600 ${Math.round(this.opts.width * 0.055)}px "Fraunces", serif`;
        ctx.textAlign = 'center';
        ctx.fillText(this.opts.title, this.opts.width / 2, this.opts.height * 0.04);
      }
      if (this.opts.subtitle) {
        ctx.font = `500 ${Math.round(this.opts.width * 0.028)}px Inter, sans-serif`;
        ctx.fillStyle = '#9aa1b1';
        ctx.fillText(this.opts.subtitle, this.opts.width / 2, this.opts.height * 0.105);
      }
      // Bottom: move label
      if (this.opts.showMoveLabel !== false && frame.moveSan && frame.moveNumber) {
        ctx.fillStyle = '#e9b465';
        ctx.font = `600 ${Math.round(this.opts.width * 0.065)}px "JetBrains Mono", monospace`;
        ctx.textAlign = 'center';
        const dotSuffix = frame.isWhite ? '.' : '…';
        ctx.fillText(
          `${frame.moveNumber}${dotSuffix} ${frame.moveSan}`,
          this.opts.width / 2,
          this.opts.height * 0.87,
        );
      }
    } else {
      // Landscape: side panel
      const sideX = this.boardX + this.boardSize + Math.round(this.opts.width * 0.04);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      if (this.opts.title) {
        ctx.fillStyle = '#e7e9ee';
        ctx.font = `600 ${Math.round(this.opts.height * 0.06)}px "Fraunces", serif`;
        wrapText(ctx, this.opts.title, sideX, this.opts.height * 0.18, this.opts.width - sideX - 40, this.opts.height * 0.07);
      }
      if (this.opts.subtitle) {
        ctx.fillStyle = '#9aa1b1';
        ctx.font = `500 ${Math.round(this.opts.height * 0.028)}px Inter, sans-serif`;
        wrapText(ctx, this.opts.subtitle, sideX, this.opts.height * 0.34, this.opts.width - sideX - 40, this.opts.height * 0.035);
      }
      if (this.opts.showMoveLabel !== false && frame.moveSan && frame.moveNumber) {
        ctx.fillStyle = '#e9b465';
        ctx.font = `600 ${Math.round(this.opts.height * 0.08)}px "JetBrains Mono", monospace`;
        const dotSuffix = frame.isWhite ? '.' : '…';
        ctx.fillText(
          `${frame.moveNumber}${dotSuffix} ${frame.moveSan}`,
          sideX,
          this.opts.height * 0.62,
        );
      }
    }
  }

  private drawPiece(sq: string, code: PieceCode, alpha: number) {
    const [fx, fy] = squareToXY(sq, this.opts.orientation);
    this.drawPieceAt(fx, fy, code, alpha);
  }

  private drawPieceAt(fx: number, fy: number, code: PieceCode, alpha: number) {
    const img = getPieceCache(this.opts.pieceSetId).bitmaps.get(code);
    if (!img) return;
    const x = this.boardX + fx * this.squareSize;
    const y = this.boardY + fy * this.squareSize;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, x, y, this.squareSize, this.squareSize);
    this.ctx.globalAlpha = 1;
  }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let curY = y;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, curY);
      line = w;
      curY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, curY);
}

// ---------- Game-to-frames timing helpers ----------

/**
 * Build an animation script: each move expands to an animation phase + a hold phase.
 * Returns timed FEN snapshots for frame-rendering.
 */
export interface TimedSnapshot {
  fenAfter: string;
  fenBefore: string;
  san: string;
  uci: string;
  from: string;
  to: string;
  moveNumber: number;
  isWhite: boolean;
  animDurationMs: number;
  holdDurationMs: number;
}

export function buildSnapshots(game: LoadedGame, animMs = 350, holdMs = 700): TimedSnapshot[] {
  const c = new Chess(game.initialFen);
  const out: TimedSnapshot[] = [];
  game.moves.forEach((m: MoveStep, i: number) => {
    const fenBefore = c.fen();
    c.move({ from: m.from, to: m.to, promotion: m.promotion });
    out.push({
      fenBefore,
      fenAfter: c.fen(),
      san: m.san,
      uci: m.uci,
      from: m.from,
      to: m.to,
      moveNumber: Math.floor(i / 2) + 1,
      isWhite: i % 2 === 0,
      animDurationMs: animMs,
      holdDurationMs: holdMs,
    });
  });
  return out;
}
