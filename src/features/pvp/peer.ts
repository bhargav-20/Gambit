/**
 * WebRTC handshake + data channel layer for PvP.
 *
 * Design constraints (set by product):
 *   - No server, ever. The signaling handshake travels via QR codes scanned
 *     between the two devices. Once the data channel is open, traffic is P2P
 *     and (on the same WiFi) goes direct over the LAN — RTT ~1-5 ms.
 *   - Single-shot SDP blobs. We disable trickle ICE by waiting for the
 *     `icegatheringstate === 'complete'` event before reading
 *     `peer.localDescription`, so the offer and answer each fit in one QR.
 *
 * Wire format for SDPs in QR:
 *   compact JSON → LZString.compressToEncodedURIComponent(...)
 *
 * Wire format for in-game messages on the data channel:
 *   JSON. Tiny payloads (~30 bytes for a move) so we don't bother compressing.
 *   See `PvpMessage` for the schema.
 */

import LZString from 'lz-string';

export interface SdpBlob {
  /** Either 'offer' (from host) or 'answer' (from joiner). */
  t: 'o' | 'a';
  /** SDP string. */
  s: string;
  /** Sender's name for the opponent strip. */
  n?: string;
  /** Host-only: the time control + the host's chosen color (so the joiner
   *  knows what to play). The joiner ignores any TC inside an answer blob. */
  tc?: { b: number; i: number };
  /** Host-only: which color the host plays. Joiner derives their color from
   *  this. 'random' is resolved by the host before sending. */
  c?: 'w' | 'b';
}

export type PvpMessage =
  | {
      /** Move played. Contains UCI and the mover's remaining clock ms after
       *  the move was committed (post-increment). */
      t: 'move';
      uci: string;
      ms: number;
      /** performance.now() at send time on the sender's clock. Used by the
       *  receiver only as a tie-break / latency hint. */
      sent: number;
    }
  | { t: 'hello'; name: string }
  | { t: 'ping'; sent: number }
  | { t: 'pong'; sent: number }
  | { t: 'resign'; loser: 'white' | 'black' }
  | { t: 'flag'; loser: 'white' | 'black' }
  | { t: 'draw-offer' }
  | { t: 'draw-accept' }
  | { t: 'draw-decline' }
  | { t: 'rematch-offer' }
  | { t: 'rematch-accept' }
  | { t: 'rematch-decline' };

export function encodeSdp(blob: SdpBlob): string {
  return LZString.compressToEncodedURIComponent(JSON.stringify(blob));
}

export function decodeSdp(encoded: string): SdpBlob | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(encoded.trim());
    if (!json) return null;
    const parsed = JSON.parse(json) as SdpBlob;
    if (!parsed || (parsed.t !== 'o' && parsed.t !== 'a') || typeof parsed.s !== 'string') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const RTC_CONFIG: RTCConfiguration = {
  // STUN-less and TURN-less. On the same WiFi the local ICE candidate is
  // sufficient; the SDP blob carries it. For cross-network play later we'd
  // add a STUN server here, but the product brief is LAN-only for v1.
  iceServers: [],
};

/** Resolve when ICE gathering completes (so localDescription contains all
 *  candidates). The `complete` event isn't quite uniform across browsers, so
 *  we poll the state and listen to icegatheringstatechange as a fallback. */
function waitForIceComplete(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    const check = () => {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', check);
        resolve();
      }
    };
    pc.addEventListener('icegatheringstatechange', check);
    // Safety net — give up trickle-style after 4s; LAN gathering is usually
    // sub-second, and we'd rather ship a possibly-truncated offer than hang.
    setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }, 4000);
  });
}

export interface PeerHandle {
  pc: RTCPeerConnection;
  channel: RTCDataChannel | null;
  send: (msg: PvpMessage) => void;
  close: () => void;
}

export interface HostStartResult {
  handle: PeerHandle;
  /** SDP offer blob to render as QR. */
  offer: SdpBlob;
  /** Call this with the joiner's answer SDP (already decoded). Resolves
   *  once the data channel is fully open. */
  acceptAnswer: (answer: SdpBlob) => Promise<void>;
}

export interface JoinerStartResult {
  handle: PeerHandle;
  /** SDP answer blob to render as QR back to the host. The data channel will
   *  open once the host applies this answer. */
  answer: SdpBlob;
  /** Resolves once the data channel reaches 'open'. */
  whenOpen: Promise<void>;
}

function makeHandle(pc: RTCPeerConnection, channel: RTCDataChannel | null): PeerHandle {
  return {
    pc,
    channel,
    send(msg) {
      if (channel && channel.readyState === 'open') {
        channel.send(JSON.stringify(msg));
      }
    },
    close() {
      try { channel?.close(); } catch { /* ignore — already gone */ }
      try { pc.close(); } catch { /* ignore */ }
    },
  };
}

export async function startHost(opts: {
  localName: string;
  timeControl: { baseMs: number; incMs: number };
  hostColor: 'white' | 'black';
}): Promise<HostStartResult> {
  const pc = new RTCPeerConnection(RTC_CONFIG);
  // Host creates the data channel — joiner picks it up via 'datachannel' event.
  const channel = pc.createDataChannel('chess', { ordered: true });
  const handle = makeHandle(pc, channel);

  const offerInit = await pc.createOffer();
  await pc.setLocalDescription(offerInit);
  await waitForIceComplete(pc);
  const ld = pc.localDescription;
  if (!ld) throw new Error('Local description missing after ICE complete');

  const offer: SdpBlob = {
    t: 'o',
    s: ld.sdp,
    n: opts.localName || 'Player',
    tc: { b: opts.timeControl.baseMs, i: opts.timeControl.incMs },
    c: opts.hostColor === 'white' ? 'w' : 'b',
  };

  return {
    handle,
    offer,
    async acceptAnswer(answer) {
      await pc.setRemoteDescription({ type: 'answer', sdp: answer.s });
    },
  };
}

export async function startJoiner(opts: {
  localName: string;
  offer: SdpBlob;
}): Promise<JoinerStartResult> {
  const pc = new RTCPeerConnection(RTC_CONFIG);

  // Allocate the handle up front so we can mutate its channel ref as soon as
  // the host's datachannel event fires. Consumers (session.ts) read handle.channel
  // after `whenOpen` resolves to attach listeners.
  const handle: PeerHandle = {
    pc,
    channel: null,
    send(msg) {
      if (handle.channel && handle.channel.readyState === 'open') {
        handle.channel.send(JSON.stringify(msg));
      }
    },
    close() {
      try { handle.channel?.close(); } catch { /* ignore */ }
      try { pc.close(); } catch { /* ignore */ }
    },
  };

  const openPromise = new Promise<void>((resolve, reject) => {
    pc.addEventListener('datachannel', (ev) => {
      handle.channel = ev.channel;
      ev.channel.addEventListener('open', () => resolve());
      ev.channel.addEventListener('error', () => reject(new Error('Channel error')));
    });
  });

  await pc.setRemoteDescription({ type: 'offer', sdp: opts.offer.s });
  const answerInit = await pc.createAnswer();
  await pc.setLocalDescription(answerInit);
  await waitForIceComplete(pc);
  const ld = pc.localDescription;
  if (!ld) throw new Error('Local description missing after ICE complete');

  const answer: SdpBlob = {
    t: 'a',
    s: ld.sdp,
    n: opts.localName || 'Player',
  };

  return { handle, answer, whenOpen: openPromise };
}

/** Attach a typed message dispatcher to a channel. Returns a disposer. */
export function listen(
  channel: RTCDataChannel,
  onMessage: (msg: PvpMessage) => void,
): () => void {
  const handler = (ev: MessageEvent<string>) => {
    try {
      const msg = JSON.parse(ev.data) as PvpMessage;
      onMessage(msg);
    } catch {
      // Ignore malformed payloads. The schema is closed; anything we don't
      // recognize is either a bug or an attacker, and either way we'd rather
      // keep the game going than throw.
    }
  };
  channel.addEventListener('message', handler);
  return () => channel.removeEventListener('message', handler);
}
