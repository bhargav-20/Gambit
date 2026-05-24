import { useEffect, useRef } from 'react';
import { Chess } from 'chess.js';
import { useGameStore } from '@/core/store/gameStore';
import { useBotStore } from '@/core/store/botStore';
import type { Square } from '@/core/chess/types';
import { getEngine } from '@/features/analysis/engine';
import { findDifficulty } from './difficulty';

/**
 * Bot autoplay loop. Watches gameStore (mode + ply) and, when it's the bot's
 * turn in a `play-bot` match, asks Stockfish for a move and applies it.
 *
 * Generation counter guards against races: if the user resets / navigates /
 * undoes mid-think, the in-flight engine response is dropped instead of
 * landing on a now-stale position.
 *
 * Singleton engine is shared with `useAnalysis`. Bot play and analysis don't
 * happen at the same time (mode gates both), so they can't race on the wire.
 */
export function useBot() {
  const mode = useGameStore((s) => s.mode);
  const ply = useGameStore((s) => s.ply);
  const game = useGameStore((s) => s.game);
  const playerColor = useBotStore((s) => s.playerColor);
  const difficulty = useBotStore((s) => s.difficulty);
  const result = useBotStore((s) => s.result);

  const genRef = useRef(0);

  useEffect(() => {
    if (mode !== 'play-bot') return;
    if (!playerColor) return;
    if (result) return;

    const fen = useGameStore.getState().currentFen();
    const sideToMove = fen.split(' ')[1] === 'w' ? 'white' : 'black';

    // First, decide if the position is terminal regardless of whose turn it is.
    const c = new Chess(fen);
    if (c.isGameOver()) {
      // Translate chess.js terminal flags to our enum. Done here (not just on
      // the bot's reply) so a stalemate the player walks into is also caught.
      const bot = useBotStore.getState();
      if (c.isCheckmate()) {
        const loser = sideToMove;
        const winner = loser === 'white' ? 'black' : 'white';
        bot.endMatch(winner, 'checkmate');
      } else if (c.isStalemate()) {
        bot.endMatch('draw', 'stalemate');
      } else if (c.isInsufficientMaterial()) {
        bot.endMatch('draw', 'insufficient');
      } else if (c.isThreefoldRepetition()) {
        bot.endMatch('draw', 'repetition');
      } else if (c.isDraw()) {
        bot.endMatch('draw', '50-move');
      }
      return;
    }

    // Only act when it's the BOT's turn.
    if (sideToMove === playerColor) return;

    // Kick off a search. Bump generation so a stale callback can be detected.
    genRef.current += 1;
    const myGen = genRef.current;
    const preset = findDifficulty(difficulty);

    useBotStore.getState().setThinking(true);
    const engine = getEngine();

    // Small leading delay so an instant move on Beginner isn't jarring after
    // the player's piece animates into place.
    const minThinkMs = 200;
    const started = performance.now();

    (async () => {
      try {
        let uci = await engine.findBestMove(fen, {
          skillLevel: preset.skillLevel,
          movetimeMs: preset.movetimeMs,
        });
        // For very weak presets, occasionally substitute a random legal move.
        // Stockfish's Skill 0 still plays ~1320 — Novice needs frequent blunders
        // to feel like a true beginner. chess.js gives us the legal-move list.
        if (preset.randomMoveRate && Math.random() < preset.randomMoveRate) {
          const probe = new Chess(fen);
          const legal = probe.moves({ verbose: true });
          if (legal.length > 0) {
            const pick = legal[Math.floor(Math.random() * legal.length)];
            uci = `${pick.from}${pick.to}${pick.promotion ?? ''}`;
          }
        }
        // Stale — user reset or moved on (e.g., started a new match).
        if (myGen !== genRef.current) return;
        // Verify the position hasn't changed under us (defensive — the only
        // way ply moves while we're searching would be the user undoing or
        // resetting, both of which already bump genRef via this same effect
        // tearing down, but belt + braces).
        const currentFen = useGameStore.getState().currentFen();
        if (currentFen !== fen) return;
        if (!uci) {
          useBotStore.getState().setThinking(false);
          return;
        }
        // Pad to minThinkMs so very fast moves still feel like "the bot
        // considered it."
        const elapsed = performance.now() - started;
        if (elapsed < minThinkMs) {
          await new Promise((r) => setTimeout(r, minThinkMs - elapsed));
        }
        if (myGen !== genRef.current) return;

        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        const promo = uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
        useGameStore.getState().applyMove(from, to, promo);
        useBotStore.getState().setThinking(false);

        // After the bot plays, check terminal state in case it just delivered
        // mate or walked into stalemate.
        const afterFen = useGameStore.getState().currentFen();
        const after = new Chess(afterFen);
        if (after.isGameOver()) {
          const next = afterFen.split(' ')[1] === 'w' ? 'white' : 'black';
          const bot = useBotStore.getState();
          if (after.isCheckmate()) {
            const winner = next === 'white' ? 'black' : 'white';
            bot.endMatch(winner, 'checkmate');
          } else if (after.isStalemate()) {
            bot.endMatch('draw', 'stalemate');
          } else if (after.isInsufficientMaterial()) {
            bot.endMatch('draw', 'insufficient');
          } else if (after.isThreefoldRepetition()) {
            bot.endMatch('draw', 'repetition');
          } else if (after.isDraw()) {
            bot.endMatch('draw', '50-move');
          }
        }
      } catch {
        if (myGen === genRef.current) {
          useBotStore.getState().setThinking(false);
        }
      }
    })();

    // If the effect re-runs (ply changes again, user resets, etc.), bump the
    // gen so the pending search's callback is treated as stale.
    return () => {
      genRef.current += 1;
    };
  }, [mode, ply, game, playerColor, difficulty, result]);
}
