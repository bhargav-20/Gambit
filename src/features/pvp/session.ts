/**
 * Singleton lifecycle for the active PvP session. Owns the PeerHandle, wires
 * incoming messages into the game + PvP stores, and manages outgoing pings /
 * disconnect grace.
 *
 * Why a module-level singleton instead of a Zustand store? The RTCPeerConnection
 * and RTCDataChannel are not serializable; we'd be storing live socket-like
 * objects in React state. The stores hold UI-facing state (status, clocks,
 * names, result); this module holds the actual wire.
 */

import { Chess } from 'chess.js';
import { useGameStore } from '@/core/store/gameStore';
import { usePvpStore } from '@/core/store/pvpStore';
import type { GameResult, EndReason, PvpColor } from '@/core/store/pvpStore';
import type { Square } from '@/core/chess/types';
import {
  startHost,
  startJoiner,
  listen,
  encodeSdp,
  decodeSdp,
  type PeerHandle,
  type PvpMessage,
} from './peer';
import { playSound } from './sounds';

interface ActiveSession {
  role: 'host' | 'joiner';
  handle: PeerHandle;
  /** Disposer for the message listener. */
  unlisten: () => void;
  /** Disposer for the ping heartbeat interval. */
  stopHeartbeat: () => void;
  /** Disposer for the channel close/state watchers. */
  stopWatch: () => void;
  /** Disposer for the rAF clock tick loop. */
  stopClock: () => void;
}

let current: ActiveSession | null = null;

/** Round-trip ping cadence. 2s is frequent enough to detect a flaky link
 *  inside the 60s grace window without burning data. */
const PING_INTERVAL_MS = 2_000;
/** Disconnect grace before the absent player flags. Product decision. */
const GRACE_MS = 60_000;

function setStatus(s: ReturnType<typeof usePvpStore.getState>['channelStatus']) {
  usePvpStore.getState().setChannelStatus(s);
}

/**
 * Wire heartbeat (ping/pong) and channel-state watchers onto a freshly opened
 * channel. Heartbeat updates the RTT shown on the opponent strip; the watcher
 * flips channelStatus on close/error and starts the disconnect grace timer.
 */
function instrumentChannel(handle: PeerHandle): Pick<ActiveSession, 'unlisten' | 'stopHeartbeat' | 'stopWatch' | 'stopClock'> {
  // Caller must only invoke this AFTER the channel is open — for the host
  // that's the channel.onopen event, for the joiner that's whenOpen resolving
  // (peer.ts mutates handle.channel in its ondatachannel handler).
  const live = handle.channel;
  if (!live) {
    return { unlisten: () => {}, stopHeartbeat: () => {}, stopWatch: () => {}, stopClock: () => {} };
  }

  const unlisten = listen(live, (msg) => onIncoming(msg, handle));

  let pingTimer: number | null = null;
  let lastPingAt = 0;
  const sendPing = () => {
    lastPingAt = performance.now();
    handle.send({ t: 'ping', sent: lastPingAt });
  };
  // First ping immediately so RTT lights up quickly, then on cadence.
  sendPing();
  pingTimer = window.setInterval(sendPing, PING_INTERVAL_MS);
  const stopHeartbeat = () => {
    if (pingTimer !== null) {
      window.clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const onClose = () => onChannelDown();
  const onError = () => onChannelDown();
  const onStateChange = () => {
    const st = handle.pc.iceConnectionState;
    if (st === 'disconnected' || st === 'failed') onChannelDown();
    if (st === 'connected' || st === 'completed') onChannelUp();
  };
  live.addEventListener('close', onClose);
  live.addEventListener('error', onError);
  handle.pc.addEventListener('iceconnectionstatechange', onStateChange);
  const stopWatch = () => {
    live.removeEventListener('close', onClose);
    live.removeEventListener('error', onError);
    handle.pc.removeEventListener('iceconnectionstatechange', onStateChange);
  };

  const stopClock = startClockLoop();

  return { unlisten, stopHeartbeat, stopWatch, stopClock };
}

function onIncoming(msg: PvpMessage, handle: PeerHandle) {
  const pvp = usePvpStore.getState();
  switch (msg.t) {
    case 'hello': {
      pvp.setOpponentName(msg.name || 'Opponent');
      break;
    }
    case 'ping': {
      // Echo back so the sender can measure RTT.
      handle.send({ t: 'pong', sent: msg.sent });
      break;
    }
    case 'pong': {
      const rtt = Math.max(0, performance.now() - msg.sent);
      pvp.setRttMs(rtt);
      break;
    }
    case 'move': {
      applyRemoteMove(msg.uci, msg.ms);
      break;
    }
    case 'resign': {
      // The loser identifies themselves; the WINNER is the other color.
      const winner: GameResult = msg.loser === 'white' ? 'black' : 'white';
      pvp.endMatch(winner, 'resign');
      playSound('end');
      break;
    }
    case 'flag': {
      const winner: GameResult = msg.loser === 'white' ? 'black' : 'white';
      pvp.endMatch(winner, 'flag');
      playSound('flag');
      break;
    }
    case 'draw-offer': {
      pvp.setDrawOffer('received');
      break;
    }
    case 'draw-accept': {
      pvp.endMatch('draw', 'agreement');
      playSound('end');
      break;
    }
    case 'draw-decline': {
      pvp.setDrawOffer(null);
      break;
    }
    case 'rematch-offer': {
      pvp.setRematchOffer('received');
      break;
    }
    case 'rematch-accept': {
      // The peer that SENT the rematch offer auto-restarts when this arrives;
      // the lobby UI also lets the accepting side restart locally.
      restartForRematch();
      break;
    }
    case 'rematch-decline': {
      pvp.setRematchOffer(null);
      break;
    }
  }
}

function applyRemoteMove(uci: string, opponentRemainingMs: number) {
  const game = useGameStore.getState();
  const pvp = usePvpStore.getState();
  if (pvp.result) return;
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const promo = uci.length === 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
  const ok = game.applyMove(from, to, promo);
  if (!ok) return;
  pvp.recordRemoteMove(opponentRemainingMs);
  playSound(uci.length === 5 ? 'promote' : 'move');
  checkBoardEnd();
}

/**
 * After any move (local or remote) check whether the chess position itself
 * is terminal — checkmate, stalemate, threefold, fifty-move, insufficient.
 * Time-based ends (flag) come in over the wire, not from this check.
 */
function checkBoardEnd() {
  const fen = useGameStore.getState().currentFen();
  const c = new Chess(fen);
  if (c.isGameOver()) {
    const pvp = usePvpStore.getState();
    if (c.isCheckmate()) {
      // chess.js's turn() now points to the SIDE TO MOVE who has been mated.
      const loser: PvpColor = c.turn() === 'w' ? 'white' : 'black';
      const winner: GameResult = loser === 'white' ? 'black' : 'white';
      pvp.endMatch(winner, 'checkmate');
      playSound('end');
    } else if (c.isStalemate()) {
      pvp.endMatch('draw', 'stalemate');
      playSound('end');
    } else if (c.isThreefoldRepetition()) {
      pvp.endMatch('draw', 'repetition');
      playSound('end');
    } else if (c.isInsufficientMaterial()) {
      pvp.endMatch('draw', 'insufficient');
      playSound('end');
    } else if (c.isDraw()) {
      // chess.js's catch-all draw includes the 50-move rule.
      pvp.endMatch('draw', '50-move');
      playSound('end');
    }
  }
}

function restartForRematch() {
  // Both players colored-swap and the clocks reset. Whichever side sent the
  // initial rematch offer originally chose color; we just swap here.
  const pvp = usePvpStore.getState();
  const newColor: PvpColor = pvp.localColor === 'white' ? 'black' : 'white';
  pvp.setLocalColor(newColor);
  pvp.setRematchOffer(null);
  useGameStore.getState().startPvp();
  pvp.startMatch();
  playSound('start');
}

/** Local-move dispatcher — called from Board2D's after handler when mode='pvp'. */
export function sendLocalMove(uci: string) {
  const pvp = usePvpStore.getState();
  const session = current;
  if (!session) return;
  if (!pvp.localColor || pvp.result) return;
  // Compute remaining after applying our increment. We tick continuously in
  // the rAF loop so whiteMs/blackMs already reflect the live countdown; just
  // add the increment for this side.
  const localMs = pvp.localColor === 'white' ? pvp.whiteMs : pvp.blackMs;
  const remaining = localMs + pvp.timeControl.incMs;
  // Update local store first so our own clock reads correctly while the
  // packet flies; the opponent will mirror this when it arrives on their end.
  pvp.recordLocalMove(remaining);
  session.handle.send({
    t: 'move',
    uci,
    ms: remaining,
    sent: performance.now(),
  });
  playSound(uci.length === 5 ? 'promote' : 'move');
  checkBoardEnd();
}

// ---- Disconnect grace ----

let graceTimer: number | null = null;
function onChannelDown() {
  const pvp = usePvpStore.getState();
  if (pvp.result || pvp.channelStatus === 'closed') return;
  setStatus('disconnected');
  pvp.setGraceDeadline(performance.now() + GRACE_MS);
  if (graceTimer !== null) window.clearTimeout(graceTimer);
  graceTimer = window.setTimeout(() => {
    // Grace expired without recovery — opponent loses on disconnect.
    const cur = usePvpStore.getState();
    if (cur.result || cur.channelStatus !== 'disconnected') return;
    const local = cur.localColor;
    if (!local) return;
    // The OTHER side is the one who went dark; they lose.
    const winner: GameResult = local;
    cur.endMatch(winner, 'disconnect');
    playSound('end');
  }, GRACE_MS + 200);
}

function onChannelUp() {
  const pvp = usePvpStore.getState();
  if (pvp.channelStatus === 'disconnected') {
    setStatus('connected');
    pvp.setGraceDeadline(null);
    if (graceTimer !== null) {
      window.clearTimeout(graceTimer);
      graceTimer = null;
    }
  }
}

// ---- Clock tick loop ----

function startClockLoop(): () => void {
  let raf: number | null = null;
  let last = performance.now();
  const tick = () => {
    const now = performance.now();
    const delta = now - last;
    last = now;
    const pvp = usePvpStore.getState();
    if (pvp.activeColor && !pvp.result && pvp.channelStatus !== 'disconnected') {
      pvp.tickClock(delta);
      // Local flag detection — if the active color has burned out and it's
      // US, send a flag to opponent and end locally.
      const remaining = pvp.activeColor === 'white' ? pvp.whiteMs : pvp.blackMs;
      if (remaining <= 0) {
        const loser = pvp.activeColor;
        const winner: GameResult = loser === 'white' ? 'black' : 'white';
        if (current) current.handle.send({ t: 'flag', loser });
        pvp.endMatch(winner, 'flag');
        playSound('flag');
      } else if (remaining < 10_000) {
        // Tick warning sound on each whole-second crossing.
        const wholeBefore = Math.floor((remaining + delta) / 1000);
        const wholeAfter = Math.floor(remaining / 1000);
        if (wholeBefore !== wholeAfter && wholeAfter <= 10 && wholeAfter > 0) {
          if (pvp.activeColor === pvp.localColor) playSound('tick');
        }
      }
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => {
    if (raf !== null) cancelAnimationFrame(raf);
  };
}

// ---- Public API used by the lobby ----

export interface HostHandshake {
  /** Encoded SDP offer to show as QR. */
  offerEncoded: string;
  /** Call this with the encoded answer scanned back from the joiner. */
  applyAnswer: (answerEncoded: string) => Promise<{ ok: true } | { ok: false; error: string }>;
}

export async function createHostSession(opts: {
  localName: string;
  hostColor: 'white' | 'black';
}): Promise<HostHandshake> {
  closeCurrent();
  const pvp = usePvpStore.getState();
  const tc = pvp.timeControl;
  const res = await startHost({
    localName: opts.localName,
    timeControl: tc,
    hostColor: opts.hostColor,
  });
  // Wait for the channel to open before instrumenting. Host's createDataChannel
  // returns a channel that becomes 'open' after the answer is applied; we set
  // up the open watcher here so instrumentation happens at the right moment.
  if (res.handle.channel) {
    const ch = res.handle.channel;
    ch.addEventListener('open', () => {
      const wired = instrumentChannel(res.handle);
      current = { role: 'host', handle: res.handle, ...wired };
      setStatus('connected');
      // Send our hello so the joiner can populate the opponent strip.
      res.handle.send({ t: 'hello', name: opts.localName || 'Player' });
      // Start the match clock on the host's clock since the host owns the
      // first move (white) — but only if the host is playing white. Either
      // way, white's clock starts running.
      usePvpStore.getState().startMatch();
      playSound('start');
    });
  }
  return {
    offerEncoded: encodeSdp(res.offer),
    applyAnswer: async (answerEncoded) => {
      const decoded = decodeSdp(answerEncoded);
      if (!decoded || decoded.t !== 'a') {
        return { ok: false, error: 'That QR / text is not a valid PvP answer.' };
      }
      try {
        await res.acceptAnswer(decoded);
        usePvpStore.getState().setOpponentName(decoded.n || 'Opponent');
        setStatus('connecting');
        return { ok: true };
      } catch (e) {
        return { ok: false, error: (e as Error).message };
      }
    },
  };
}

export interface JoinerHandshake {
  /** Encoded SDP answer to show as QR back to the host. */
  answerEncoded: string;
  /** Promise that resolves when the data channel reaches 'open'. */
  whenConnected: Promise<void>;
}

export async function joinSession(opts: {
  localName: string;
  offerEncoded: string;
}): Promise<{ ok: true; handshake: JoinerHandshake } | { ok: false; error: string }> {
  closeCurrent();
  const decoded = decodeSdp(opts.offerEncoded);
  if (!decoded || decoded.t !== 'o') {
    return { ok: false, error: 'That QR / text is not a valid PvP offer.' };
  }
  // The host blob carries the time control + the host's color choice. Mirror
  // them locally before the channel opens so the lobby can move forward.
  // beginJoiner() must run FIRST since it resets session state (including
  // localColor) to fresh defaults; we set the per-session fields after.
  const pvp = usePvpStore.getState();
  pvp.beginJoiner();
  if (decoded.tc) {
    pvp.setTimeControl({ baseMs: decoded.tc.b, incMs: decoded.tc.i });
  }
  if (decoded.c) {
    // Host's color was 'w'/'b'; joiner is the opposite.
    const hostColor = decoded.c === 'w' ? 'white' : 'black';
    pvp.setLocalColor(hostColor === 'white' ? 'black' : 'white');
  }
  pvp.setOpponentName(decoded.n || 'Opponent');

  try {
    const res = await startJoiner({ localName: opts.localName, offer: decoded });
    res.whenOpen.then(() => {
      // peer.ts mutated res.handle.channel inside its ondatachannel handler;
      // by the time whenOpen resolves, handle.channel is the live, open
      // channel and instrumentChannel can attach its listeners directly.
      const wired = instrumentChannel(res.handle);
      current = { role: 'joiner', handle: res.handle, ...wired };
      setStatus('connected');
      res.handle.send({ t: 'hello', name: opts.localName || 'Player' });
      usePvpStore.getState().startMatch();
      playSound('start');
    });
    return {
      ok: true,
      handshake: {
        answerEncoded: encodeSdp(res.answer),
        whenConnected: res.whenOpen,
      },
    };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export function getCurrent(): ActiveSession | null {
  return current;
}

export function closeCurrent() {
  if (!current) return;
  try { current.unlisten(); } catch { /* ignore */ }
  try { current.stopHeartbeat(); } catch { /* ignore */ }
  try { current.stopWatch(); } catch { /* ignore */ }
  try { current.stopClock(); } catch { /* ignore */ }
  try { current.handle.close(); } catch { /* ignore */ }
  current = null;
  if (graceTimer !== null) {
    window.clearTimeout(graceTimer);
    graceTimer = null;
  }
}

// Convenience send-helpers used by the match panel.
export function sendResign() {
  const pvp = usePvpStore.getState();
  if (!current || !pvp.localColor) return;
  current.handle.send({ t: 'resign', loser: pvp.localColor });
  const winner: GameResult = pvp.localColor === 'white' ? 'black' : 'white';
  pvp.endMatch(winner, 'resign');
  playSound('end');
}

export function sendDrawOffer() {
  const pvp = usePvpStore.getState();
  if (!current || pvp.result) return;
  current.handle.send({ t: 'draw-offer' });
  pvp.setDrawOffer('sent');
}

export function acceptDraw() {
  const pvp = usePvpStore.getState();
  if (!current) return;
  current.handle.send({ t: 'draw-accept' });
  pvp.endMatch('draw', 'agreement');
  playSound('end');
}

export function declineDraw() {
  const pvp = usePvpStore.getState();
  if (!current) return;
  current.handle.send({ t: 'draw-decline' });
  pvp.setDrawOffer(null);
}

export function sendRematchOffer() {
  const pvp = usePvpStore.getState();
  if (!current) return;
  current.handle.send({ t: 'rematch-offer' });
  pvp.setRematchOffer('sent');
}

export function acceptRematch() {
  if (!current) return;
  current.handle.send({ t: 'rematch-accept' });
  restartForRematch();
}

export function declineRematch() {
  const pvp = usePvpStore.getState();
  if (!current) return;
  current.handle.send({ t: 'rematch-decline' });
  pvp.setRematchOffer(null);
}

// Re-export EndReason so importing modules don't need a separate import.
export type { EndReason };
