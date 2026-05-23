import { create } from 'zustand';
import type { Square, Color } from '@/core/chess/types';

/**
 * Position-setup workspace. Owns the board state, side-to-move, castling
 * rights, en-passant, and the currently "armed" piece (the one a click on
 * the board will place).
 *
 * Lives separately from gameStore because the rules are different:
 *   - No move history, no legality enforcement.
 *   - Every state change can produce a position that's mid-edit and not
 *     yet legal (no kings, two kings same color, etc.) — validity is a
 *     derived check, not a precondition.
 *   - Castling and en-passant fields are user-editable (the user might
 *     be reconstructing a position from a screenshot where castling
 *     hasn't been spent yet).
 *
 * Source of truth: the `squares` map. Castling / EP / side-to-move are
 * declared separately because they can't be derived from pieces alone.
 */

// Single-character FEN piece code: lowercase = black, uppercase = white.
export type FenPiece = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K' | 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

/** Tray selection: a piece to place, the eraser, or nothing armed. */
export type ArmedTool = FenPiece | 'eraser' | null;

export interface CastlingRights {
  K: boolean;
  Q: boolean;
  k: boolean;
  q: boolean;
}

/** Snapshot of every mutable field used by undo — armed is intentionally
 *  excluded since restoring it would surprise the user (the active tool
 *  doesn't relate to the position itself). */
interface Snapshot {
  squares: Partial<Record<Square, FenPiece>>;
  sideToMove: Color;
  castling: CastlingRights;
  enPassant: Square | null;
  halfmove: number;
  fullmove: number;
}

interface SetupState {
  /** Sparse map: square → piece, or absent if empty. */
  squares: Partial<Record<Square, FenPiece>>;
  sideToMove: Color;
  castling: CastlingRights;
  /** En-passant target square (the square the capturing pawn would land on). */
  enPassant: Square | null;
  halfmove: number;
  fullmove: number;
  armed: ArmedTool;
  /** Undo stack — most recent snapshot is the last element. Capped at HISTORY_LIMIT. */
  history: Snapshot[];

  // ----- Mutations (each pushes a history entry first) -----
  setPiece: (sq: Square, piece: FenPiece) => void;
  clearSquare: (sq: Square) => void;
  /** Move a piece between two squares as a single undo step. Used by the
   *  free-edit drag handler so one drag = one undo. */
  movePiece: (from: Square, to: Square) => void;
  /** Replace the entire piece state from a parsed FEN piece-placement map. */
  setSquares: (squares: Partial<Record<Square, FenPiece>>) => void;
  clearBoard: () => void;
  loadStartingPosition: () => void;
  flipSide: () => void;
  setSide: (c: Color) => void;
  setCastlingRight: (k: keyof CastlingRights, on: boolean) => void;
  setEnPassant: (sq: Square | null) => void;
  setHalfmove: (n: number) => void;
  setFullmove: (n: number) => void;
  setArmed: (t: ArmedTool) => void;

  /** Pop the most recent snapshot off the stack. No-op when empty. */
  undo: () => void;
  /** True if there's at least one history entry to pop. */
  canUndo: () => boolean;

  /** Load from a full FEN string. Resets armed and clamps numbers. */
  loadFen: (fen: string) => { ok: true } | { ok: false; error: string };
  /** Serialize current state to a full FEN. Does NOT validate. */
  toFen: () => string;
}

const HISTORY_LIMIT = 50;

const FILES: Square[0][] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as Square[0][];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

function startingSquares(): Partial<Record<Square, FenPiece>> {
  // r n b q k b n r
  // p p p p p p p p
  // ...
  // P P P P P P P P
  // R N B Q K B N R
  const out: Partial<Record<Square, FenPiece>> = {};
  const backRank: FenPiece[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  FILES.forEach((file, i) => {
    out[`${file}8` as Square] = backRank[i];
    out[`${file}7` as Square] = 'p';
    out[`${file}2` as Square] = 'P';
    out[`${file}1` as Square] = backRank[i].toUpperCase() as FenPiece;
  });
  return out;
}

function serializePieces(squares: Partial<Record<Square, FenPiece>>): string {
  const rows: string[] = [];
  for (const rank of RANKS) {
    let row = '';
    let empty = 0;
    for (const file of FILES) {
      const p = squares[`${file}${rank}` as Square];
      if (p) {
        if (empty > 0) { row += String(empty); empty = 0; }
        row += p;
      } else {
        empty++;
      }
    }
    if (empty > 0) row += String(empty);
    rows.push(row);
  }
  return rows.join('/');
}

function parsePiecePlacement(piecePart: string): Partial<Record<Square, FenPiece>> {
  const rows = piecePart.split('/');
  if (rows.length !== 8) throw new Error(`expected 8 rows, got ${rows.length}`);
  const out: Partial<Record<Square, FenPiece>> = {};
  rows.forEach((row, ri) => {
    let file = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        file += parseInt(ch, 10);
        continue;
      }
      if (!/[prnbqkPRNBQK]/.test(ch)) {
        throw new Error(`bad piece char "${ch}" on rank ${8 - ri}`);
      }
      if (file > 7) throw new Error(`overflow on rank ${8 - ri}`);
      const sq = `${FILES[file]}${8 - ri}` as Square;
      out[sq] = ch as FenPiece;
      file++;
    }
    if (file !== 8) throw new Error(`underflow on rank ${8 - ri} (saw ${file} squares)`);
  });
  return out;
}

function parseCastling(s: string): CastlingRights {
  return {
    K: s.includes('K'),
    Q: s.includes('Q'),
    k: s.includes('k'),
    q: s.includes('q'),
  };
}

function serializeCastling(c: CastlingRights): string {
  let s = '';
  if (c.K) s += 'K';
  if (c.Q) s += 'Q';
  if (c.k) s += 'k';
  if (c.q) s += 'q';
  return s || '-';
}

const STARTPOS_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/** Snapshot current state for the undo stack. Excludes `armed` and
 *  `history` itself (we don't store the stack inside the stack). */
function snapshot(s: SetupState): Snapshot {
  return {
    squares: { ...s.squares },
    sideToMove: s.sideToMove,
    castling: { ...s.castling },
    enPassant: s.enPassant,
    halfmove: s.halfmove,
    fullmove: s.fullmove,
  };
}

export const useSetupStore = create<SetupState>((set, get) => {
  // Closing over the store's set lets each mutation use the same push-then-mutate
  // pattern without scattering history bookkeeping across every action body.
  const pushHistory = () => {
    const cur = get();
    const next = [...cur.history, snapshot(cur)];
    // Drop oldest if we'd exceed the limit so the buffer stays bounded.
    set({ history: next.length > HISTORY_LIMIT ? next.slice(-HISTORY_LIMIT) : next });
  };

  return {
    // Default to an empty board — the user is here to build something, so we
    // don't pre-fill with the standard starting position. Clicking "Start" in
    // the panel still resets to STARTPOS when they want it.
    squares: {},
    sideToMove: 'w',
    castling: { K: false, Q: false, k: false, q: false },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
    armed: null,
    history: [],

    setPiece: (sq, piece) => {
      pushHistory();
      set((s) => ({ squares: { ...s.squares, [sq]: piece } }));
    },
    clearSquare: (sq) => {
      pushHistory();
      set((s) => {
        const next = { ...s.squares };
        delete next[sq];
        return { squares: next };
      });
    },
    movePiece: (from, to) => {
      pushHistory();
      set((s) => {
        const piece = s.squares[from];
        if (!piece) return s;
        const next = { ...s.squares, [to]: piece };
        delete next[from];
        return { squares: next };
      });
    },
    setSquares: (squares) => {
      pushHistory();
      set({ squares });
    },
    clearBoard: () => {
      pushHistory();
      set({ squares: {}, castling: { K: false, Q: false, k: false, q: false }, enPassant: null });
    },
    loadStartingPosition: () => {
      pushHistory();
      set({
        squares: startingSquares(),
        sideToMove: 'w',
        castling: { K: true, Q: true, k: true, q: true },
        enPassant: null,
        halfmove: 0,
        fullmove: 1,
      });
    },
    flipSide: () => {
      pushHistory();
      set((s) => ({ sideToMove: s.sideToMove === 'w' ? 'b' : 'w' }));
    },
    setSide: (c) => {
      pushHistory();
      set({ sideToMove: c });
    },
    setCastlingRight: (k, on) => {
      pushHistory();
      set((s) => ({ castling: { ...s.castling, [k]: on } }));
    },
    setEnPassant: (sq) => {
      pushHistory();
      set({ enPassant: sq });
    },
    setHalfmove: (n) => {
      pushHistory();
      set({ halfmove: Math.max(0, Math.floor(n)) });
    },
    setFullmove: (n) => {
      pushHistory();
      set({ fullmove: Math.max(1, Math.floor(n)) });
    },
    // Armed is a transient tool selection, not part of the position — don't
    // snapshot or restore it during undo.
    setArmed: (t) => set({ armed: t }),

    undo: () => {
      const cur = get();
      if (cur.history.length === 0) return;
      const prev = cur.history[cur.history.length - 1];
      set({
        squares: prev.squares,
        sideToMove: prev.sideToMove,
        castling: prev.castling,
        enPassant: prev.enPassant,
        halfmove: prev.halfmove,
        fullmove: prev.fullmove,
        history: cur.history.slice(0, -1),
      });
    },
    canUndo: () => get().history.length > 0,

    loadFen: (fen) => {
      try {
        const parts = fen.trim().split(/\s+/);
        if (parts.length < 4) throw new Error('FEN missing fields');
        const [pieces, side, castling, ep, half = '0', full = '1'] = parts;
        const squares = parsePiecePlacement(pieces);
        if (side !== 'w' && side !== 'b') throw new Error(`bad side-to-move "${side}"`);
        pushHistory();
        set({
          squares,
          sideToMove: side as Color,
          castling: parseCastling(castling),
          enPassant: ep === '-' ? null : (ep as Square),
          halfmove: Math.max(0, parseInt(half, 10) || 0),
          fullmove: Math.max(1, parseInt(full, 10) || 1),
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },

    toFen: () => {
      const s = get();
      return [
        serializePieces(s.squares),
        s.sideToMove,
        serializeCastling(s.castling),
        s.enPassant ?? '-',
        String(s.halfmove),
        String(s.fullmove),
      ].join(' ');
    },
  };
});

export { STARTPOS_FEN };
