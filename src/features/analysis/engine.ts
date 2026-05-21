/**
 * Thin wrapper around Stockfish-18-lite running in a dedicated Web Worker.
 * Communicates via the UCI protocol (line-based text messages).
 *
 * We treat each evaluation request as a transactional sequence:
 *   ucinewgame  (only on first use)
 *   position fen <fen>
 *   go depth N
 *   <wait for "bestmove ..." line>
 *
 * While searching we capture the latest `info ... score cp X ... pv Y ...`
 * line so callers get live updates as the engine deepens.
 */

export interface EvalSnapshot {
  /** Score in centipawns from white's perspective (positive = white better). */
  cp: number | null;
  /** Forced mate distance from side-to-move, signed white-positive. */
  mate: number | null;
  /** Search depth reached. */
  depth: number;
  /** Engine's best move so far, in UCI long-algebraic (e.g. "e2e4", "e7e8q"). */
  bestMove: string | null;
  /** Principal variation as UCI tokens. */
  pv: string[];
  /** True once the engine emits "bestmove" — the eval has converged. */
  done: boolean;
}

type Listener = (snapshot: EvalSnapshot) => void;

const STOCKFISH_PATH = '/stockfish/stockfish-18-lite-single.js';

export class StockfishEngine {
  private worker: Worker | null = null;
  private ready = false;
  private readyResolvers: Array<() => void> = [];
  private currentListener: Listener | null = null;
  private currentSnapshot: EvalSnapshot = freshSnapshot();
  private currentFen: string | null = null;
  /** Monotonic id so stale callbacks from previous searches can be dropped. */
  private searchId = 0;

  /** Lazy-load the worker on first call. */
  async init(): Promise<void> {
    if (this.worker) {
      if (this.ready) return;
      return new Promise<void>((resolve) => this.readyResolvers.push(resolve));
    }

    this.worker = new Worker(STOCKFISH_PATH);
    this.worker.onmessage = (e) => this.handleMessage(e.data);
    this.worker.onerror = (e) => {
      // eslint-disable-next-line no-console
      console.error('Stockfish worker error:', e);
    };

    this.send('uci');
    this.send('setoption name Threads value 1');
    this.send('setoption name Hash value 16');
    this.send('isready');

    return new Promise<void>((resolve) => this.readyResolvers.push(resolve));
  }

  /**
   * Begin evaluating a position. The listener is invoked once with the final
   * snapshot when search completes (and may be invoked again with interim
   * results — caller decides whether to consume them).
   */
  async evaluate(fen: string, depth: number, onUpdate?: Listener): Promise<EvalSnapshot> {
    await this.init();

    // Stop any in-flight search before starting a new one.
    if (this.currentListener) {
      this.send('stop');
    }
    this.searchId += 1;
    const myId = this.searchId;
    this.currentFen = fen;
    this.currentSnapshot = freshSnapshot();

    return new Promise<EvalSnapshot>((resolve) => {
      this.currentListener = (snap) => {
        if (this.searchId !== myId) return;            // search superseded
        onUpdate?.(snap);
        if (snap.done) resolve(snap);
      };
      this.send(`position fen ${fen}`);
      this.send(`go depth ${depth}`);
    });
  }

  /** Cancel any running search; the next evaluate() will start fresh. */
  stop(): void {
    if (!this.worker) return;
    this.send('stop');
  }

  /** Shut down the worker and release resources. */
  dispose(): void {
    if (!this.worker) return;
    try { this.send('quit'); } catch { /* ignore */ }
    this.worker.terminate();
    this.worker = null;
    this.ready = false;
    this.currentListener = null;
  }

  private send(cmd: string): void {
    if (!this.worker) return;
    this.worker.postMessage(cmd);
  }

  private handleMessage(raw: unknown): void {
    if (typeof raw !== 'string') return;
    // Stockfish sometimes emits multi-line buffers — split and walk each.
    for (const line of raw.split('\n')) {
      this.handleLine(line.trim());
    }
  }

  private handleLine(line: string): void {
    if (!line) return;

    if (line === 'readyok' || line === 'uciok') {
      if (!this.ready) {
        this.ready = true;
        this.readyResolvers.forEach((r) => r());
        this.readyResolvers = [];
      }
      return;
    }

    if (line.startsWith('info ')) {
      this.parseInfo(line);
      return;
    }

    if (line.startsWith('bestmove')) {
      // bestmove e2e4 ponder ...
      const tokens = line.split(/\s+/);
      const move = tokens[1] && tokens[1] !== '(none)' ? tokens[1] : null;
      if (move) this.currentSnapshot.bestMove = move;
      this.currentSnapshot.done = true;
      this.currentListener?.(this.currentSnapshot);
      this.currentListener = null;
      return;
    }
  }

  /**
   * Parse a UCI `info` line. We only care about depth / score / pv. Lines may
   * have arbitrary token order, so walk by keyword.
   *
   * Score is always reported from the side-to-move's perspective. We flip it
   * so the caller always sees white-positive numbers.
   */
  private parseInfo(line: string): void {
    const tokens = line.split(/\s+/);
    let i = 1;
    let depth: number | null = null;
    let cp: number | null = null;
    let mate: number | null = null;
    let pv: string[] | null = null;

    while (i < tokens.length) {
      const t = tokens[i];
      if (t === 'depth') {
        depth = parseInt(tokens[++i], 10);
      } else if (t === 'score') {
        const kind = tokens[++i];
        const value = parseInt(tokens[++i], 10);
        if (kind === 'cp') cp = value;
        else if (kind === 'mate') mate = value;
      } else if (t === 'pv') {
        pv = tokens.slice(i + 1);
        break;
      }
      i++;
    }

    if (depth !== null) this.currentSnapshot.depth = depth;

    const whiteToMove = this.currentFen ? this.currentFen.split(' ')[1] === 'w' : true;
    if (cp !== null) {
      this.currentSnapshot.cp = whiteToMove ? cp : -cp;
      this.currentSnapshot.mate = null;
    }
    if (mate !== null) {
      this.currentSnapshot.mate = whiteToMove ? mate : -mate;
      this.currentSnapshot.cp = null;
    }
    if (pv && pv.length) {
      this.currentSnapshot.pv = pv;
      this.currentSnapshot.bestMove = pv[0] ?? null;
    }

    // Emit interim progress to the listener — but mark as not-done so callers
    // can keep a smooth animation without thinking the search is over.
    this.currentListener?.({ ...this.currentSnapshot });
  }
}

function freshSnapshot(): EvalSnapshot {
  return { cp: null, mate: null, depth: 0, bestMove: null, pv: [], done: false };
}

// Singleton engine instance. The first feature to need it triggers init().
let _engine: StockfishEngine | null = null;
export function getEngine(): StockfishEngine {
  if (!_engine) _engine = new StockfishEngine();
  return _engine;
}
