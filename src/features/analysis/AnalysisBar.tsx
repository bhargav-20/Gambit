import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import {
  GitBranch, Microscope,
} from 'lucide-react';

/**
 * Strip that sits below the playback controls in the info column.
 *
 * In the new layout the info column is game-context only; the dedicated
 * AnalyzePanel (right column) owns all engine controls. So this bar's only
 * job now is to surface the route-transition affordances on routes where
 * the user is just *viewing* a loaded game (visualizer): two buttons that
 * navigate to /analyze with the right intent.
 *
 *   - "Analyze this game" → /analyze, snapshot current game, branch from
 *                            anywhere; "Back to game" restores it.
 *   - "Branch from here"  → /analyze with truncation at the current ply;
 *                            the user takes ownership of the variation.
 *
 * On analyze / puzzle / pvp / no-game routes the bar renders nothing.
 */
export function ComposerBar() {
  const mode = useGameStore((s) => s.mode);
  const hasMoves = useGameStore((s) => s.game.moves.length > 0);

  if (mode === 'puzzle' || mode === 'pvp' || mode === 'analyze') return null;
  if (!hasMoves) return null;
  return <VisualizerActions />;
}

/** Alias kept so older callers (App.tsx) don't have to change their import. */
export { ComposerBar as AnalysisBar };

function VisualizerActions() {
  const navigate = useNavigate();
  const hasMoves = useGameStore((s) => s.game.moves.length > 0);
  const ply = useGameStore((s) => s.ply);

  // "Branch from here" only makes sense when the user is mid-game — at
  // ply 0 there's nothing to truncate (you'd just analyze the whole line
  // anyway) and at the final move there are no future moves to drop.
  const canBranch = hasMoves && ply > 0 && ply < useGameStore.getState().game.moves.length;

  return (
    <div className="flex flex-col gap-2">
      <button
        className="btn justify-center gap-2"
        onClick={() => navigate('/analyze')}
        disabled={!hasMoves}
        title={hasMoves ? 'Study this game with branching and engine help' : 'Load a game first'}
      >
        <Microscope size={14} className="text-accent" />
        Analyze this game
      </button>
      <button
        className="btn justify-center gap-2"
        onClick={() => navigate('/analyze', { state: { startFromHere: true } })}
        disabled={!canBranch}
        title={canBranch
          ? 'Take the moves played so far and branch from this position'
          : 'Step into the game first — branching needs a midpoint to fork from'}
      >
        <GitBranch size={14} className="text-accent" />
        Branch from here
      </button>
    </div>
  );
}


