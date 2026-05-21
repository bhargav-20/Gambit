import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { LoadedGame, MoveStep, Square } from '@/core/chess/types';
import { fenAtPly, lastMoveAtPly, loadEmpty, loadPgn, STARTPOS } from '@/core/chess/pgn';

export type PlaybackSpeed = 0.5 | 1 | 1.5 | 2 | 3;
export type Promotable = 'q' | 'r' | 'b' | 'n';

/**
 * Top-level interaction mode for the board. Each mode is a self-contained
 * UX state with its own input rules, engine behavior, and side panels.
 *
 *  - 'visualizer': An opening / game is loaded. The user replays it. No
 *                  board input. No engine.
 *  - 'composer':   Free-play space. Edit always on, engine runs, Undo pops.
 *                  Moves replace any "future" moves (truncates+appends).
 *                  The opening context is gone — this is the user's
 *                  composition.
 *  - 'analyze':    Studying a loaded game. Edit on, engine on, branches
 *                  are EXPLORATORY: the original game lives in a snapshot
 *                  and "Back to game" restores it (with the ply set to
 *                  where the user first branched). Distinct from composer
 *                  because the original game stays intact.
 *  - 'puzzle':     Solving a tactic. Edit on but restricted — only the
 *                  correct next move is accepted. No engine. No composer
 *                  UI; the puzzle owns the panel.
 */
export type GameMode = 'visualizer' | 'composer' | 'analyze' | 'puzzle';

export interface PendingPromotion {
  from: Square;
  to: Square;
  color: 'w' | 'b';
}

interface GameState {
  game: LoadedGame;
  ply: number;                  // 0 = starting position, moves.length = end
  playing: boolean;
  speed: PlaybackSpeed;
  editMode: boolean;            // when true, board accepts user moves
  orientation: 'white' | 'black';
  pendingPromotion: PendingPromotion | null;
  mode: GameMode;
  /** Original game retained in 'analyze' so "Back to game" can restore it. */
  analyzeSnapshot: LoadedGame | null;
  /** Ply at which the user first branched in 'analyze'. Set on first applyMove
   *  during analyze; cleared on backToGame / exitAnalyze. */
  branchPly: number | null;

  // Derived helpers
  currentFen: () => string;
  lastMoveSquares: () => [Square, Square] | undefined;

  // Actions
  loadGame: (game: LoadedGame) => void;
  loadFromPgn: (pgn: string, meta?: Partial<LoadedGame['meta']>) => { ok: true } | { ok: false; error: string };
  reset: () => void;

  goTo: (ply: number) => void;
  next: () => void;
  prev: () => void;
  first: () => void;
  last: () => void;

  play: () => void;
  pause: () => void;
  toggle: () => void;
  setSpeed: (s: PlaybackSpeed) => void;

  flip: () => void;

  setEditMode: (on: boolean) => void;
  applyMove: (from: Square, to: Square, promotion?: Promotable) => boolean;
  truncateAfterCurrent: () => void;   // drop moves past the current ply (used before recording a new branch)

  requestPromotion: (from: Square, to: Square, color: 'w' | 'b') => void;
  resolvePromotion: (piece: Promotable) => void;
  cancelPromotion: () => void;

  /**
   * Exit the opening and enter the free-play composer at the current
   * position. The opening's title and future moves are dropped — what
   * lives on is a fresh "Composition" seeded with the moves played so far.
   */
  composeFromHere: () => void;
  /**
   * Start a fresh composition from the empty starting position. Drops into
   * composer mode immediately so the user can play. Use this when entering
   * composer without an opening loaded.
   */
  startComposition: () => void;
  /** Leave composer for visualizer. The composition itself stays loaded. */
  exitComposer: () => void;
  /** Pop the last move in composer mode. No-op if there's nothing to pop. */
  undoMove: () => void;

  /** Enter analyze mode: snapshot the current game, allow branching. */
  analyzeGame: () => void;
  /** Leave analyze mode. The snapshot is discarded; the current line stays
   *  loaded so the user can keep viewing whatever they were exploring. */
  exitAnalyze: () => void;
  /** Restore the snapshot and jump to the branch-out ply. Only meaningful
   *  in analyze mode after the user has branched. */
  backToGame: () => void;

  /** Switch into puzzle mode (used by PuzzlePanel — keeps mode coherent so
   *  the composer/analyze UI hides). */
  startPuzzle: () => void;
  /** Leave puzzle mode back to visualizer. */
  endPuzzle: () => void;
}

const blank: LoadedGame = loadEmpty(STARTPOS, { title: 'New game', source: 'editor' });

export const useGameStore = create<GameState>((set, get) => ({
  game: blank,
  ply: 0,
  playing: false,
  speed: 1,
  editMode: false,
  orientation: 'white',
  pendingPromotion: null,
  mode: 'visualizer',
  analyzeSnapshot: null,
  branchPly: null,

  currentFen: () => fenAtPly(get().game, get().ply),
  lastMoveSquares: () => lastMoveAtPly(get().game, get().ply),

  loadGame: (game) => set({
    game, ply: 0, playing: false, editMode: false, mode: 'visualizer',
    analyzeSnapshot: null, branchPly: null,
  }),

  loadFromPgn: (pgn, meta) => {
    try {
      const game = loadPgn(pgn, meta);
      set({
        game, ply: 0, playing: false, editMode: false, mode: 'visualizer',
        analyzeSnapshot: null, branchPly: null,
      });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  },

  reset: () => set({
    game: loadEmpty(), ply: 0, playing: false, editMode: false, mode: 'visualizer',
    analyzeSnapshot: null, branchPly: null,
  }),

  goTo: (ply) => {
    const max = get().game.moves.length;
    const clamped = Math.max(0, Math.min(max, ply));
    set({ ply: clamped });
  },
  next: () => {
    const { ply, game } = get();
    if (ply < game.moves.length) set({ ply: ply + 1 });
    else set({ playing: false });
  },
  prev: () => {
    const { ply } = get();
    if (ply > 0) set({ ply: ply - 1 });
  },
  first: () => set({ ply: 0 }),
  last: () => set({ ply: get().game.moves.length }),

  play: () => {
    const { ply, game } = get();
    if (ply >= game.moves.length) set({ ply: 0, playing: true });
    else set({ playing: true });
  },
  pause: () => set({ playing: false }),
  toggle: () => (get().playing ? get().pause() : get().play()),
  setSpeed: (s) => set({ speed: s }),

  flip: () => set({ orientation: get().orientation === 'white' ? 'black' : 'white' }),

  /**
   * Direct toggle. Mostly used by Puzzle mode to put the board into an
   * editable state without dropping into composer. Keeps `mode` in sync
   * so the rest of the app's mode-based gates (analysis engine, etc.) see
   * a coherent picture.
   */
  setEditMode: (on) => {
    set({ editMode: on, playing: false, mode: on ? 'composer' : 'visualizer' });
  },

  composeFromHere: () => {
    const state = get();
    if (state.mode === 'composer') return;
    // The user explicitly says "exit the opening, let me play from here."
    // Build a brand-new game whose history is just the moves played so far
    // in the opening — no opening title, no future moves carried over.
    // Once we're in composer, the game is fully owned by the user.
    const sourceTitle = state.game.meta.title;
    const composition: LoadedGame = {
      meta: {
        id: Math.random().toString(36).slice(2, 10),
        title: 'Composition',
        description:
          sourceTitle && sourceTitle !== 'Composition' && sourceTitle !== 'New game'
            ? `Started from ${sourceTitle} (move ${Math.max(1, Math.ceil(state.ply / 2))})`
            : undefined,
        source: 'editor',
      },
      initialFen: state.game.initialFen,
      moves: state.game.moves.slice(0, state.ply),
      rawPgn: '',
    };
    set({
      mode: 'composer',
      game: composition,
      // ply unchanged — user is at the end of the composition's history.
      editMode: true,
      playing: false,
    });
  },

  startComposition: () => {
    // Fresh empty board, dropped straight into composer mode. Used by
    // "Start new composition" in the Compose tab — the explicit way to
    // enter the free-play space without an opening loaded.
    set({
      game: loadEmpty(STARTPOS, { title: 'Composition', source: 'editor' }),
      ply: 0,
      playing: false,
      mode: 'composer',
      editMode: true,
    });
  },

  exitComposer: () => {
    // Just switch back to replay-only. The composition stays loaded so the
    // user can scrub through what they composed. To open a different game
    // they reload from the catalog or paste a PGN.
    set({ mode: 'visualizer', editMode: false, playing: false });
  },

  undoMove: () => {
    const state = get();
    // Available in composer AND analyze — both involve user-played moves
    // that can be rolled back one at a time.
    if (state.mode !== 'composer' && state.mode !== 'analyze') return;
    if (state.game.moves.length === 0) return;
    const newPly = Math.max(0, state.ply - 1);
    set({
      game: { ...state.game, moves: state.game.moves.slice(0, newPly) },
      ply: newPly,
    });
  },

  analyzeGame: () => {
    const state = get();
    if (state.mode === 'analyze') return;
    // Snapshot the FULL original line — back-to-game restores from this.
    set({
      mode: 'analyze',
      analyzeSnapshot: state.game,
      branchPly: null,
      editMode: true,
      playing: false,
    });
  },

  exitAnalyze: () => {
    // Drop the snapshot. The current live game stays loaded so the user can
    // keep viewing whatever they were exploring; mode flips to visualizer.
    set({
      mode: 'visualizer',
      analyzeSnapshot: null,
      branchPly: null,
      editMode: false,
      playing: false,
    });
  },

  backToGame: () => {
    const state = get();
    if (state.mode !== 'analyze' || !state.analyzeSnapshot) return;
    // Restore the original. Jump to the divergence point if there was one,
    // otherwise stay at the current ply.
    const restorePly = state.branchPly ?? state.ply;
    set({
      game: state.analyzeSnapshot,
      ply: Math.min(restorePly, state.analyzeSnapshot.moves.length),
      branchPly: null,
    });
  },

  startPuzzle: () => set({
    mode: 'puzzle',
    editMode: true,
    playing: false,
    // Clear any analyze leftovers — puzzles are unrelated.
    analyzeSnapshot: null,
    branchPly: null,
  }),

  endPuzzle: () => set({
    mode: 'visualizer',
    editMode: false,
    playing: false,
  }),

  truncateAfterCurrent: () => {
    const { game, ply } = get();
    if (ply >= game.moves.length) return;
    set({ game: { ...game, moves: game.moves.slice(0, ply) } });
  },

  requestPromotion: (from, to, color) => set({ pendingPromotion: { from, to, color } }),

  resolvePromotion: (piece) => {
    const pending = get().pendingPromotion;
    set({ pendingPromotion: null });
    if (!pending) return;
    get().applyMove(pending.from, pending.to, piece);
  },

  cancelPromotion: () => set({ pendingPromotion: null }),

  applyMove: (from, to, promotion) => {
    const state = get();
    const { game, ply } = state;
    const baseMoves = game.moves.slice(0, ply);
    const baseFen = ply === 0 ? game.initialFen : baseMoves[baseMoves.length - 1].fenAfter;
    const c = new Chess(baseFen);
    const result = c.move({ from, to, promotion });
    if (!result) return false;
    const newMove: MoveStep = {
      san: result.san,
      uci: `${result.from}${result.to}${result.promotion ?? ''}`,
      from: result.from as Square,
      to: result.to as Square,
      fenAfter: c.fen(),
      capture: !!result.captured,
      check: /[+#]/.test(result.san),
      promotion: result.promotion as MoveStep['promotion'],
    };
    const moves = [...baseMoves, newMove];
    const next: Partial<typeof state> = { game: { ...game, moves }, ply: moves.length };
    // Analyze mode: if this is the first user-played move, remember the ply
    // we branched from so "Back to game" can restore the snapshot and jump
    // back there. Subsequent moves in the same branch don't change branchPly.
    if (state.mode === 'analyze' && state.branchPly === null) {
      next.branchPly = ply;
    }
    set(next);
    return true;
  },
}));
