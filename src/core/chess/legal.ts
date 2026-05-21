import { Chess, SQUARES } from 'chess.js';
import type { Square } from './types';

/**
 * Compute the destination-squares map chessground expects: { from -> [to, ...] }.
 * Used in editor mode so the user can only play legal moves while composing.
 */
export function dests(fen: string): Map<string, string[]> {
  const c = new Chess(fen);
  const map = new Map<string, string[]>();
  for (const sq of SQUARES) {
    const moves = c.moves({ square: sq as Square, verbose: true });
    if (moves.length) map.set(sq, moves.map((m) => m.to));
  }
  return map;
}

export function turnColor(fen: string): 'white' | 'black' {
  return fen.split(' ')[1] === 'w' ? 'white' : 'black';
}
