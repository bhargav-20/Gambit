import { Chess } from 'chess.js';
import type { LoadedGame, MoveStep, Square, GameMeta } from './types';

const STARTPOS = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function makeId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function toUci(from: string, to: string, promotion?: string): string {
  return `${from}${to}${promotion ?? ''}`;
}

/**
 * Replay a PGN deterministically. chess.js's PGN parser handles headers,
 * comments, NAGs, and SAN moves — we then re-walk to capture intermediate FENs.
 */
export function loadPgn(pgn: string, metaOverride?: Partial<GameMeta>): LoadedGame {
  const game = new Chess();
  // chess.js .loadPgn throws on malformed PGN; let the caller catch.
  game.loadPgn(pgn, { strict: false });

  const headers = game.header();
  const sanHistory = game.history({ verbose: true });

  // Reset and walk forward, recording each step's FEN.
  const replay = new Chess(headers.FEN ?? STARTPOS);
  const moves: MoveStep[] = sanHistory.map((m) => {
    const result = replay.move({ from: m.from, to: m.to, promotion: m.promotion });
    if (!result) throw new Error(`Illegal move while replaying: ${m.san}`);
    return {
      san: result.san,
      uci: toUci(result.from, result.to, result.promotion),
      from: result.from as Square,
      to: result.to as Square,
      fenAfter: replay.fen(),
      capture: /[x]/.test(result.san) || !!result.captured,
      check: /[+#]/.test(result.san),
      promotion: result.promotion as MoveStep['promotion'],
    };
  });

  const undef = (v: string | null | undefined): string | undefined => (v == null ? undefined : v);
  const title =
    metaOverride?.title ??
    (headers.White && headers.Black ? `${headers.White} vs ${headers.Black}` : 'Untitled game');

  return {
    meta: {
      id: makeId(),
      title,
      white: undef(headers.White),
      black: undef(headers.Black),
      event: undef(headers.Event),
      date: undef(headers.Date),
      eco: metaOverride?.eco ?? undef(headers.ECO),
      description: metaOverride?.description,
      openingId: metaOverride?.openingId,
      source: metaOverride?.source ?? 'paste',
    },
    initialFen: undef(headers.FEN) ?? STARTPOS,
    moves,
    rawPgn: pgn.trim(),
  };
}

/**
 * Build a LoadedGame from a starting FEN with no moves yet — used by the
 * visual editor to seed a blank or custom position.
 */
export function loadEmpty(initialFen = STARTPOS, meta?: Partial<GameMeta>): LoadedGame {
  return {
    meta: {
      id: makeId(),
      title: meta?.title ?? 'New game',
      source: meta?.source ?? 'editor',
      description: meta?.description,
    },
    initialFen,
    moves: [],
    rawPgn: '',
  };
}

/**
 * Serialize a list of moves back to a PGN string. Used by the editor when
 * the user composes a moveset by playing moves on the board.
 */
export function gameToPgn(game: LoadedGame): string {
  const c = new Chess(game.initialFen);
  for (const m of game.moves) c.move({ from: m.from, to: m.to, promotion: m.promotion });
  if (game.meta.title) c.header('Event', game.meta.title);
  if (game.meta.white) c.header('White', game.meta.white);
  if (game.meta.black) c.header('Black', game.meta.black);
  if (game.initialFen !== STARTPOS) c.header('FEN', game.initialFen);
  return c.pgn();
}

export function fenAtPly(game: LoadedGame, ply: number): string {
  if (ply <= 0) return game.initialFen;
  const idx = Math.min(ply, game.moves.length) - 1;
  return game.moves[idx].fenAfter;
}

export function lastMoveAtPly(game: LoadedGame, ply: number): [Square, Square] | undefined {
  if (ply <= 0) return undefined;
  const idx = Math.min(ply, game.moves.length) - 1;
  const m = game.moves[idx];
  return [m.from, m.to];
}

/**
 * Group SAN moves into move pairs for display: [ ["e4","e5"], ["Nf3","Nc6"], ... ]
 */
export function pairMoves(moves: MoveStep[]): Array<[MoveStep | null, MoveStep | null]> {
  const pairs: Array<[MoveStep | null, MoveStep | null]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push([moves[i] ?? null, moves[i + 1] ?? null]);
  }
  return pairs;
}

export { STARTPOS };
