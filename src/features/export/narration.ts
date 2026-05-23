import type { LoadedGame, MoveStep } from '@/core/chess/types';
import type { Opening } from '@/features/openings/catalog';
import type { FamousGame } from '@/features/games/catalog';

/**
 * Narration text generator. Produces per-move prose that a TTS engine (or
 * the live SpeechSynthesis preview) reads aloud during playback.
 *
 * The text source ladder, per move:
 *
 *   1. Famous-game curated note     (catalogued game's `moveNotes[ply-1]`)
 *   2. Opening curated note         (catalogued opening's `moveNotes[ply-1]`)
 *   3. SAN-to-English mechanical    (always available, last resort)
 *
 * Curated notes win because they were hand-written by humans for that
 * exact move. The mechanical fallback turns a move like `Nxe5+` into
 * "White's knight takes on e5, with check" — clear enough that a user
 * watching unfamiliar mid-game positions still gets context.
 *
 * Intro / outro lines are derived from whatever metadata is loaded:
 *   - Famous game → players, event, year, an opening sentence framing
 *     what the listener is about to see.
 *   - Catalogued opening → the opening's `description` tagline.
 *   - Bare PGN → a neutral "Welcome — playing through this game move by
 *     move" line.
 *
 * Style hints (`tutorial`, `analyst`, `dramatic`) are kept on the API
 * surface for v2 — the v1 generator picks the analyst tone for everything.
 */

export type NarrationStyle = 'tutorial' | 'analyst' | 'dramatic';

export interface NarrationContext {
  game: LoadedGame;
  /** Optional — looked up by the caller from openings/catalog. */
  opening?: Opening;
  /** Optional — looked up by the caller from games/catalog. */
  famousGame?: FamousGame;
  /** Reserved for v2. Ignored in v1; everything reads in the analyst tone. */
  style?: NarrationStyle;
}

export interface NarrationScript {
  /** What's spoken before move 1. */
  intro: string;
  /** One string per ply, 0-indexed. perMove[0] = the first move's commentary. */
  perMove: string[];
  /** What's spoken after the last move. */
  outro: string;
}

/** Generate the full narration script for the loaded game. */
export function generateNarration(ctx: NarrationContext): NarrationScript {
  const { game, opening, famousGame } = ctx;
  const perMove = game.moves.map((mv, i) => composeMoveLine(mv, i, opening, famousGame));
  return {
    intro: composeIntro(game, opening, famousGame),
    perMove,
    outro: composeOutro(game, famousGame),
  };
}

// ---------- Intro / outro ----------

function composeIntro(game: LoadedGame, opening?: Opening, famous?: FamousGame): string {
  if (famous) {
    const players = `${famous.players.white} versus ${famous.players.black}`;
    const event = famous.event ? `, played at ${famous.event}` : '';
    const date = famous.date ? `, ${famous.date.split('.')[0]}` : '';
    return `${famous.title}. ${players}${event}${date}. ${firstSentence(famous.narrative)}`;
  }
  if (opening) {
    return `${opening.name}. ${opening.description}`;
  }
  return game.meta.title
    ? `${game.meta.title}. Playing through this game move by move.`
    : 'Playing through this game move by move.';
}

function composeOutro(game: LoadedGame, famous?: FamousGame): string {
  if (famous) {
    const result = resultPhrase(famous.result);
    return `${result}. ${firstSentence(famous.outcome)}`;
  }
  // No catalogued outcome — narrate from the last move's check/checkmate
  // status when available; otherwise just close cleanly.
  const last = game.moves[game.moves.length - 1];
  if (last?.san.endsWith('#')) {
    const winner = last.san.endsWith('#') && game.moves.length % 2 === 1 ? 'White' : 'Black';
    return `Checkmate. ${winner} wins.`;
  }
  return 'And that brings the game to a close.';
}

function resultPhrase(r: '1-0' | '0-1' | '1/2-1/2'): string {
  if (r === '1-0') return 'White wins';
  if (r === '0-1') return 'Black wins';
  return 'The game ends in a draw';
}

function firstSentence(paragraph: string): string {
  // Grab the first sentence — narrative blobs in our catalog are 2-4
  // paragraphs long, way too much for an intro spoken aloud. Falls back to
  // a length-bounded prefix if no sentence terminator is found.
  const m = paragraph.match(/^[^.!?]+[.!?]/);
  if (m) return m[0].trim();
  return paragraph.slice(0, 180).trim() + (paragraph.length > 180 ? '…' : '');
}

// ---------- Per-move composition ----------

function composeMoveLine(
  mv: MoveStep,
  zeroIndexedPly: number,
  opening?: Opening,
  famous?: FamousGame,
): string {
  // Curated note wins over mechanical narration. Famous-game notes beat
  // opening notes (since a famous game's commentary is the more specific
  // context for that exact position).
  const curated = famous?.moveNotes?.[zeroIndexedPly] ?? opening?.moveNotes?.[zeroIndexedPly];
  const mechanical = sanToEnglish(mv, zeroIndexedPly);
  if (curated && curated.trim()) {
    // Prepend a short move identifier so the listener still hears the
    // SAN context, then let the curated note carry the meaning.
    return `${moveNumber(zeroIndexedPly)}. ${curated}`;
  }
  return mechanical;
}

function moveNumber(zeroIndexedPly: number): string {
  // ply 0 (white's 1st) → "Move 1, White"
  // ply 1 (black's 1st) → "Move 1, Black"
  const fullMove = Math.floor(zeroIndexedPly / 2) + 1;
  const side = zeroIndexedPly % 2 === 0 ? 'White' : 'Black';
  return `Move ${fullMove}, ${side}`;
}

/**
 * Turn a single SAN move into natural-sounding prose. Best-effort: handles
 * castling, captures, promotion, check / checkmate, and the standard piece
 * letters. Disambiguation prefixes (Nbd2 → "Nb to d2") are read literally
 * since the canonical "knight from the b-file to d2" rendering would
 * confuse listeners more than help.
 */
function sanToEnglish(mv: MoveStep, zeroIndexedPly: number): string {
  const san = mv.san;
  const side = zeroIndexedPly % 2 === 0 ? 'White' : 'Black';

  // Castling — both notations.
  if (san.startsWith('O-O-O')) {
    return `${moveNumber(zeroIndexedPly)}. ${side} castles queenside${suffix(san)}.`;
  }
  if (san.startsWith('O-O')) {
    return `${moveNumber(zeroIndexedPly)}. ${side} castles kingside${suffix(san)}.`;
  }

  // Promotion — `e8=Q+`, `bxa1=N#` etc.
  const promoMatch = san.match(/=([QRBN])([+#])?$/);
  let promotionText = '';
  if (promoMatch) promotionText = `, promoting to a ${pieceName(promoMatch[1])}`;

  // Pawn capture — e.g. `exd5`, `cxb3+`. The from-file is the first char,
  // capture is the `x`, the destination is the 2-char square after it.
  const pawnCap = san.match(/^([a-h])x([a-h][1-8])/);
  if (pawnCap) {
    return `${moveNumber(zeroIndexedPly)}. ${side}'s ${pawnCap[1]}-pawn takes on ${pawnCap[2]}${promotionText}${suffix(san)}.`;
  }

  // Piece capture — `Nxe5`, `Bxh7+`, `Qxd5`. May have disambiguation:
  // `Nbxd5`, `R1xa5`, `Nf3xd4`.
  const pieceCap = san.match(/^([KQRBN])([a-h]?[1-8]?)x([a-h][1-8])/);
  if (pieceCap) {
    return `${moveNumber(zeroIndexedPly)}. ${side}'s ${pieceName(pieceCap[1])} takes on ${pieceCap[3]}${suffix(san)}.`;
  }

  // Piece move (no capture) — `Nf3`, `Qd2`, with possible disambiguation.
  const pieceMove = san.match(/^([KQRBN])([a-h]?[1-8]?)([a-h][1-8])/);
  if (pieceMove) {
    return `${moveNumber(zeroIndexedPly)}. ${side} plays ${pieceName(pieceMove[1])} to ${pieceMove[3]}${suffix(san)}.`;
  }

  // Simple pawn push — `e4`, `d5`, possibly with promotion `e8=Q`.
  const pawnPush = san.match(/^([a-h])(\d)/);
  if (pawnPush) {
    return `${moveNumber(zeroIndexedPly)}. ${side} plays pawn to ${pawnPush[1]}${pawnPush[2]}${promotionText}${suffix(san)}.`;
  }

  // Fall through — read the SAN literally rather than producing nothing.
  return `${moveNumber(zeroIndexedPly)}. ${side} plays ${san}.`;
}

function pieceName(letter: string): string {
  switch (letter) {
    case 'K': return 'king';
    case 'Q': return 'queen';
    case 'R': return 'rook';
    case 'B': return 'bishop';
    case 'N': return 'knight';
    default:  return 'piece';
  }
}

function suffix(san: string): string {
  if (san.endsWith('#')) return ', checkmate';
  if (san.endsWith('+')) return ', check';
  return '';
}
