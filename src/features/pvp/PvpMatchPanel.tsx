import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import { usePvpStore } from '@/core/store/pvpStore';
import { useUiStore } from '@/core/store/uiStore';
import type { EndReason, GameResult } from '@/core/store/pvpStore';
import { MoveList } from '@/features/playback/MoveList';
import {
  Flag, Handshake, Volume2, VolumeX, Trophy, Frown, Equal, RotateCcw, Search, Wifi, Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import {
  sendResign, sendDrawOffer, acceptDraw, declineDraw,
  sendRematchOffer, acceptRematch, declineRematch, closeCurrent,
} from './session';

/**
 * Active-game panel for PvP. Combines the move list with the action row
 * (resign / draw / mute) and overlays an end card when the match concludes.
 * Replaces GamePanel in the right column when mode='pvp'.
 */
export function PvpMatchPanel() {
  const channelStatus = usePvpStore((s) => s.channelStatus);
  const result = usePvpStore((s) => s.result);
  const endReason = usePvpStore((s) => s.endReason);
  const drawOffer = usePvpStore((s) => s.drawOffer);
  const rematchOffer = usePvpStore((s) => s.rematchOffer);
  const muted = useUiStore((s) => s.pvpMuted);
  const setMuted = useUiStore((s) => s.setPvpMuted);
  const localColor = usePvpStore((s) => s.localColor);
  const endPvp = useGameStore((s) => s.endPvp);
  const navigate = useNavigate();

  const newRoom = () => {
    // Tear down the session and bounce back to the lobby. The PlayRoute's
    // exit effect will also clean up if the user navigates elsewhere first.
    closeCurrent();
    usePvpStore.getState().reset();
    endPvp();
    navigate('/play');
  };

  const analyzeThis = () => {
    // Drop the WebRTC channel but keep the played game in memory.
    // /analyze handles flipping into analyze mode on mount.
    closeCurrent();
    usePvpStore.getState().reset();
    navigate('/analyze');
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0 relative">
      {/* Status banner — visible while connecting and while disconnected,
          hidden once we're live AND not ended. */}
      {channelStatus !== 'connected' && !result && (
        <StatusBanner status={channelStatus} />
      )}

      {/* Action row */}
      {!result && channelStatus === 'connected' && (
        <div className="flex items-center gap-1.5">
          <button
            className="btn text-xs flex-1"
            onClick={sendResign}
            title="Resign the match"
          >
            <Flag size={12} /> Resign
          </button>
          <button
            className={clsx('btn text-xs flex-1', drawOffer === 'sent' && 'opacity-60')}
            onClick={() => drawOffer !== 'sent' && sendDrawOffer()}
            disabled={drawOffer === 'sent'}
            title={drawOffer === 'sent' ? 'Draw offer pending' : 'Offer a draw'}
          >
            <Handshake size={12} /> {drawOffer === 'sent' ? 'Offer sent' : 'Draw'}
          </button>
          <button
            className="btn-icon"
            onClick={() => setMuted(!muted)}
            title={muted ? 'Unmute sounds' : 'Mute sounds'}
          >
            {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </button>
        </div>
      )}

      {/* Draw offer received — inline accept/decline */}
      {drawOffer === 'received' && !result && (
        <div className="panel-tight border-accent/50 bg-accent/[0.06] p-3 text-xs">
          <p className="text-ink mb-2">Your opponent offers a draw.</p>
          <div className="flex gap-2">
            <button className="btn-primary text-xs flex-1" onClick={acceptDraw}>Accept</button>
            <button className="btn text-xs flex-1" onClick={declineDraw}>Decline</button>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <MoveList />
        {/* End card overlay */}
        {result && (
          <EndCard
            result={result}
            reason={endReason}
            localColor={localColor}
            rematchOffer={rematchOffer}
            onRematchOffer={sendRematchOffer}
            onRematchAccept={acceptRematch}
            onRematchDecline={declineRematch}
            onAnalyze={analyzeThis}
            onNewRoom={newRoom}
          />
        )}
      </div>
    </div>
  );
}

function StatusBanner({ status }: { status: ReturnType<typeof usePvpStore.getState>['channelStatus'] }) {
  if (status === 'disconnected') {
    return (
      <div className="panel-tight border-bad/40 bg-bad/5 p-3 text-xs text-bad flex items-center gap-2">
        <Wifi size={12} className="animate-pulse" />
        <span>Opponent disconnected. Waiting for reconnect…</span>
      </div>
    );
  }
  if (status === 'connecting' || status === 'offering' || status === 'answering') {
    return (
      <div className="panel-tight p-3 text-xs text-ink-muted flex items-center gap-2">
        <Loader2 size={12} className="animate-spin" />
        <span>Connecting…</span>
      </div>
    );
  }
  return null;
}

function EndCard({
  result,
  reason,
  localColor,
  rematchOffer,
  onRematchOffer,
  onRematchAccept,
  onRematchDecline,
  onAnalyze,
  onNewRoom,
}: {
  result: GameResult;
  reason: EndReason | null;
  localColor: 'white' | 'black' | null;
  rematchOffer: 'sent' | 'received' | null;
  onRematchOffer: () => void;
  onRematchAccept: () => void;
  onRematchDecline: () => void;
  onAnalyze: () => void;
  onNewRoom: () => void;
}) {
  const youWon = result !== 'draw' && result === localColor;
  const isDraw = result === 'draw';

  const headline = isDraw ? 'Draw' : youWon ? 'You won' : 'You lost';
  const headlineColor = isDraw ? 'text-ink' : youWon ? 'text-good' : 'text-bad';
  const Icon = isDraw ? Equal : youWon ? Trophy : Frown;

  return (
    <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="panel p-4 w-full max-w-[300px] flex flex-col items-center gap-3 animate-in fade-in slide-in-from-bottom-3 duration-300">
        <Icon size={28} className={headlineColor} />
        <h3 className={clsx('font-display text-xl', headlineColor)}>{headline}</h3>
        <p className="text-xs text-ink-muted text-center">{reasonText(reason, result, localColor)}</p>

        {rematchOffer === 'received' ? (
          <div className="w-full flex flex-col gap-2 mt-1">
            <p className="text-xs text-center text-ink">Opponent offers a rematch.</p>
            <div className="flex gap-2">
              <button className="btn-primary text-xs flex-1" onClick={onRematchAccept}>
                <RotateCcw size={12} /> Accept
              </button>
              <button className="btn text-xs flex-1" onClick={onRematchDecline}>
                Decline
              </button>
            </div>
          </div>
        ) : rematchOffer === 'sent' ? (
          <button className="btn w-full text-xs opacity-60" disabled>
            <Loader2 size={12} className="animate-spin" /> Rematch offered — waiting
          </button>
        ) : (
          <button className="btn-primary w-full text-xs" onClick={onRematchOffer}>
            <RotateCcw size={12} /> Offer rematch
          </button>
        )}

        <div className="flex gap-2 w-full">
          <button className="btn text-xs flex-1" onClick={onAnalyze}>
            <Search size={12} /> Analyze
          </button>
          <button className="btn text-xs flex-1" onClick={onNewRoom}>
            New room
          </button>
        </div>
      </div>
    </div>
  );
}

function reasonText(reason: EndReason | null, result: GameResult, localColor: 'white' | 'black' | null): string {
  const youWon = result !== 'draw' && result === localColor;
  switch (reason) {
    case 'checkmate':  return youWon ? 'by checkmate' : 'by checkmate';
    case 'resign':     return youWon ? 'opponent resigned' : 'you resigned';
    case 'flag':       return youWon ? 'opponent ran out of time' : 'you ran out of time';
    case 'agreement':  return 'by agreement';
    case 'disconnect': return youWon ? 'opponent disconnected' : 'connection lost';
    case 'stalemate':  return 'stalemate';
    case 'repetition': return 'threefold repetition';
    case 'insufficient': return 'insufficient material';
    case '50-move':    return 'fifty-move rule';
    default:           return '';
  }
}
