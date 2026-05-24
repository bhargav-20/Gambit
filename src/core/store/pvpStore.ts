import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Where in the QR-handshake choreography this peer currently sits.
 *
 *  idle             → no PvP session yet, lobby is shown
 *  offering         → host has generated an SDP offer and is showing it as QR
 *                     while waiting for the joiner's answer SDP
 *  answering        → joiner has scanned the host's offer and is showing
 *                     their own SDP answer as QR, waiting for host to scan
 *  connecting       → ICE negotiation underway, no data channel open yet
 *  connected        → data channel open, game in progress (or about to start)
 *  disconnected     → channel dropped, grace window is counting down
 *  closed           → session terminated (resign, flag, agreement, grace expiry)
 */
export type ChannelStatus =
  | 'idle'
  | 'offering'
  | 'answering'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'closed';

export type PvpRole = 'host' | 'joiner';
export type PvpColor = 'white' | 'black';

export interface TimeControl {
  /** Base time per side in milliseconds. */
  baseMs: number;
  /** Increment added on each completed move, in milliseconds. */
  incMs: number;
}

export type EndReason =
  | 'checkmate'
  | 'resign'
  | 'flag'
  | 'agreement'
  | 'disconnect'
  | 'stalemate'
  | 'insufficient'
  | 'repetition'
  | '50-move';

export type GameResult = 'white' | 'black' | 'draw';

export const PRESET_TIME_CONTROLS: Array<{ id: string; label: string; tc: TimeControl }> = [
  { id: '1+0',  label: '1 + 0 — Bullet',     tc: { baseMs: 60_000,    incMs: 0     } },
  { id: '3+2',  label: '3 + 2 — Blitz',      tc: { baseMs: 180_000,   incMs: 2_000 } },
  { id: '5+3',  label: '5 + 3 — Blitz',      tc: { baseMs: 300_000,   incMs: 3_000 } },
  { id: '10+0', label: '10 + 0 — Rapid',     tc: { baseMs: 600_000,   incMs: 0     } },
  { id: '15+10', label: '15 + 10 — Rapid',   tc: { baseMs: 900_000,   incMs: 10_000 } },
];

interface PvpState {
  // Identity
  localName: string;
  opponentName: string;

  // Session config — chosen in the lobby before handshake.
  role: PvpRole | null;
  /** The host's preferred color choice; once both peers agree, both sides
   *  set their own localColor accordingly. 'random' is resolved at handshake. */
  preferredColor: PvpColor | 'random';
  localColor: PvpColor | null;
  timeControl: TimeControl;

  // Connection
  channelStatus: ChannelStatus;
  /** Round-trip-time in ms (from heartbeat). Null until first pong arrives. */
  rttMs: number | null;
  /** perfNow() at which the disconnect grace window expires. Null when not
   *  in a disconnected state. */
  graceDeadlineAt: number | null;

  // Clocks — each side's remaining ms, plus which color is currently
  // burning time. lastTickAt is a performance.now() reference for the
  // delta-based tick loop in useClock().
  whiteMs: number;
  blackMs: number;
  activeColor: PvpColor | null;
  lastTickAt: number | null;

  // Result
  result: GameResult | null;
  endReason: EndReason | null;

  // Offers
  drawOffer: 'sent' | 'received' | null;
  rematchOffer: 'sent' | 'received' | null;

  // ---- Actions ----
  setLocalName: (name: string) => void;
  setTimeControl: (tc: TimeControl) => void;
  setPreferredColor: (c: PvpColor | 'random') => void;

  /** Initialize for a new host session and move to 'offering'. */
  beginHost: () => void;
  /** Initialize for a new joiner session and move to 'answering' once the
   *  host's offer has been scanned. */
  beginJoiner: () => void;

  setRole: (role: PvpRole) => void;
  setLocalColor: (color: PvpColor) => void;
  setOpponentName: (name: string) => void;
  setChannelStatus: (s: ChannelStatus) => void;
  setRttMs: (ms: number | null) => void;
  setGraceDeadline: (at: number | null) => void;

  /** Start the white clock once both sides are connected and ready. */
  startMatch: () => void;
  /** Apply a local move's clock delta and hand the active turn to opponent.
   *  remainingMs is what the local side has left immediately after moving
   *  (post-increment). */
  recordLocalMove: (remainingMs: number) => void;
  /** Apply opponent's move clock delta and switch active back to local. */
  recordRemoteMove: (opponentRemainingMs: number) => void;
  /** Tick from rAF loop: decrement the active color's clock by deltaMs. */
  tickClock: (deltaMs: number) => void;

  setDrawOffer: (o: 'sent' | 'received' | null) => void;
  setRematchOffer: (o: 'sent' | 'received' | null) => void;

  /** Mark the match ended. Stops clocks, sets result/reason, transitions to
   *  'closed'. */
  endMatch: (result: GameResult, reason: EndReason) => void;

  /** Wipe session state so the lobby returns. Keeps persisted user prefs
   *  (name, default time control, preferred color). */
  reset: () => void;
}

const FRESH_SESSION = {
  role: null,
  localColor: null,
  opponentName: '',
  channelStatus: 'idle' as ChannelStatus,
  rttMs: null,
  graceDeadlineAt: null,
  activeColor: null as PvpColor | null,
  lastTickAt: null as number | null,
  result: null as GameResult | null,
  endReason: null as EndReason | null,
  drawOffer: null as PvpState['drawOffer'],
  rematchOffer: null as PvpState['rematchOffer'],
};

export const usePvpStore = create<PvpState>()(
  persist(
    (set, get) => ({
      localName: '',
      opponentName: '',
      role: null,
      preferredColor: 'random',
      localColor: null,
      timeControl: PRESET_TIME_CONTROLS[2].tc,    // 5+3 default
      channelStatus: 'idle',
      rttMs: null,
      graceDeadlineAt: null,
      whiteMs: PRESET_TIME_CONTROLS[2].tc.baseMs,
      blackMs: PRESET_TIME_CONTROLS[2].tc.baseMs,
      activeColor: null,
      lastTickAt: null,
      result: null,
      endReason: null,
      drawOffer: null,
      rematchOffer: null,

      setLocalName: (name) => set({ localName: name }),
      setTimeControl: (tc) =>
        set({ timeControl: tc, whiteMs: tc.baseMs, blackMs: tc.baseMs }),
      setPreferredColor: (c) => set({ preferredColor: c }),

      beginHost: () => {
        const tc = get().timeControl;
        set({
          ...FRESH_SESSION,
          role: 'host',
          channelStatus: 'offering',
          whiteMs: tc.baseMs,
          blackMs: tc.baseMs,
        });
      },
      beginJoiner: () => {
        const tc = get().timeControl;
        set({
          ...FRESH_SESSION,
          role: 'joiner',
          channelStatus: 'answering',
          whiteMs: tc.baseMs,
          blackMs: tc.baseMs,
        });
      },

      setRole: (role) => set({ role }),
      setLocalColor: (color) => set({ localColor: color }),
      setOpponentName: (name) => set({ opponentName: name }),
      setChannelStatus: (s) => set({ channelStatus: s }),
      setRttMs: (ms) => set({ rttMs: ms }),
      setGraceDeadline: (at) => set({ graceDeadlineAt: at }),

      startMatch: () => {
        const tc = get().timeControl;
        set({
          whiteMs: tc.baseMs,
          blackMs: tc.baseMs,
          activeColor: 'white',
          lastTickAt: performance.now(),
          result: null,
          endReason: null,
          drawOffer: null,
          rematchOffer: null,
        });
      },

      recordLocalMove: (remainingMs) => {
        const s = get();
        if (!s.localColor || s.result) return;
        const opponent: PvpColor = s.localColor === 'white' ? 'black' : 'white';
        const whiteMs = s.localColor === 'white' ? remainingMs : s.whiteMs;
        const blackMs = s.localColor === 'black' ? remainingMs : s.blackMs;
        set({
          whiteMs,
          blackMs,
          activeColor: opponent,
          lastTickAt: performance.now(),
        });
      },

      recordRemoteMove: (opponentRemainingMs) => {
        const s = get();
        if (!s.localColor || s.result) return;
        const opponent: PvpColor = s.localColor === 'white' ? 'black' : 'white';
        const whiteMs = opponent === 'white' ? opponentRemainingMs : s.whiteMs;
        const blackMs = opponent === 'black' ? opponentRemainingMs : s.blackMs;
        set({
          whiteMs,
          blackMs,
          activeColor: s.localColor,
          lastTickAt: performance.now(),
        });
      },

      tickClock: (deltaMs) => {
        const s = get();
        if (!s.activeColor || s.result) return;
        if (s.activeColor === 'white') {
          set({ whiteMs: Math.max(0, s.whiteMs - deltaMs), lastTickAt: performance.now() });
        } else {
          set({ blackMs: Math.max(0, s.blackMs - deltaMs), lastTickAt: performance.now() });
        }
      },

      setDrawOffer: (o) => set({ drawOffer: o }),
      setRematchOffer: (o) => set({ rematchOffer: o }),

      endMatch: (result, reason) =>
        set({
          result,
          endReason: reason,
          activeColor: null,
          lastTickAt: null,
          channelStatus: 'closed',
          drawOffer: null,
        }),

      reset: () => {
        const tc = get().timeControl;
        set({
          ...FRESH_SESSION,
          whiteMs: tc.baseMs,
          blackMs: tc.baseMs,
        });
      },
    }),
    {
      name: 'shatran:pvp',
      // Persist only user-level prefs. A live session can't survive a reload
      // anyway because the WebRTC channel dies — gameStore.onRehydrateStorage
      // already drops mode='pvp' back to 'visualizer'.
      partialize: (s) => ({
        localName: s.localName,
        preferredColor: s.preferredColor,
        timeControl: s.timeControl,
      }),
    },
  ),
);
