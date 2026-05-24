import { useNavigate } from 'react-router-dom';
import { Flag, Trophy, Frown, Equal, RotateCcw, Search, Loader2, Bot } from 'lucide-react';
import clsx from 'clsx';
import { useGameStore } from '@/core/store/gameStore';
import { useBotStore } from '@/core/store/botStore';
import type { BotResult, BotEndReason, BotColor } from '@/core/store/botStore';
import { MoveList } from '@/features/playback/MoveList';
import { findDifficulty } from './difficulty';

/**
 * In-game panel for play-bot mode. Mirrors PvpMatchPanel structurally —
 * action row above the move list, end card overlay on result — but the
 * actions are simpler (no draw offers, no rematch handshake).
 */
export function BotMatchPanel() {
  const navigate = useNavigate();
  const result = useBotStore((s) => s.result);
  const endReason = useBotStore((s) => s.endReason);
  const playerColor = useBotStore((s) => s.playerColor);
  const thinking = useBotStore((s) => s.thinking);
  const difficulty = useBotStore((s) => s.difficulty);
  const preset = findDifficulty(difficulty);

  const resign = () => {
    if (!playerColor || result) return;
    const winner = playerColor === 'white' ? 'black' : 'white';
    useBotStore.getState().endMatch(winner, 'resign');
  };

  const playAgain = () => {
    // Keep the same difficulty + color preference; restart the board.
    const pref = useBotStore.getState().preferredColor;
    const resolved: BotColor =
      pref === 'random' ? (Math.random() < 0.5 ? 'white' : 'black') : pref;
    useGameStore.getState().startBot();
    useBotStore.getState().startMatch(resolved);
    if (useGameStore.getState().orientation !== resolved) {
      useGameStore.getState().flip();
    }
  };

  const analyzeThis = () => {
    // The played game stays in gameStore; /analyze mounts and flips mode.
    useBotStore.getState().reset();
    navigate('/analyze');
  };

  return (
    <div className="flex flex-col gap-2 h-full min-h-0 relative">
      <div className="flex items-center gap-2 text-xs">
        <Bot size={12} className="text-accent" />
        <span className="text-ink-muted">vs Stockfish</span>
        <span className="text-ink">·</span>
        <span className="text-ink font-medium">{preset.label}</span>
        <span className="text-ink-faint font-mono">{preset.approxElo}</span>
      </div>

      {/* Action row */}
      {!result && (
        <div className="flex items-center gap-1.5">
          <button className="btn text-xs flex-1" onClick={resign}>
            <Flag size={12} /> Resign
          </button>
          {thinking && (
            <span className="text-[11px] text-ink-faint inline-flex items-center gap-1.5 px-2">
              <Loader2 size={12} className="animate-spin" /> Thinking…
            </span>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 relative">
        <MoveList />
        {result && (
          <EndCard
            result={result}
            reason={endReason}
            playerColor={playerColor}
            onPlayAgain={playAgain}
            onAnalyze={analyzeThis}
          />
        )}
      </div>
    </div>
  );
}

function EndCard({
  result,
  reason,
  playerColor,
  onPlayAgain,
  onAnalyze,
}: {
  result: BotResult;
  reason: BotEndReason | null;
  playerColor: BotColor | null;
  onPlayAgain: () => void;
  onAnalyze: () => void;
}) {
  const youWon = result !== 'draw' && result === playerColor;
  const isDraw = result === 'draw';
  const headline = isDraw ? 'Draw' : youWon ? 'You won' : 'You lost';
  const color = isDraw ? 'text-ink' : youWon ? 'text-good' : 'text-bad';
  const Icon = isDraw ? Equal : youWon ? Trophy : Frown;

  return (
    <div className="absolute inset-0 bg-bg/85 backdrop-blur-sm flex items-center justify-center p-3">
      <div className="panel p-4 w-full max-w-[300px] flex flex-col items-center gap-3">
        <Icon size={28} className={color} />
        <h3 className={clsx('font-display text-xl', color)}>{headline}</h3>
        <p className="text-xs text-ink-muted text-center">{reasonText(reason, result, playerColor)}</p>
        <button className="btn-primary w-full text-xs" onClick={onPlayAgain}>
          <RotateCcw size={12} /> Play again
        </button>
        <button className="btn w-full text-xs" onClick={onAnalyze}>
          <Search size={12} /> Analyze this game
        </button>
      </div>
    </div>
  );
}

function reasonText(reason: BotEndReason | null, result: BotResult, playerColor: BotColor | null): string {
  const youWon = result !== 'draw' && result === playerColor;
  switch (reason) {
    case 'checkmate':    return 'by checkmate';
    case 'resign':       return youWon ? 'opponent resigned' : 'you resigned';
    case 'stalemate':    return 'stalemate';
    case 'repetition':   return 'threefold repetition';
    case 'insufficient': return 'insufficient material';
    case '50-move':      return 'fifty-move rule';
    default:             return '';
  }
}
