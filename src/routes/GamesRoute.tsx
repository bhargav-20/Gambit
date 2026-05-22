import { Link } from 'react-router-dom';
import { Trophy, ArrowLeft } from 'lucide-react';

/**
 * `/games` — stub for the famous-games catalog (Immortal, Evergreen, Opera
 * Game, etc.). Lives on the roadmap; the route exists today so the nav
 * link goes somewhere meaningful rather than nowhere.
 */
export function GamesRoute() {
  return (
    <div className="w-full max-w-2xl mx-auto p-6 sm:p-10 flex flex-col items-center text-center gap-4">
      <div className="h-14 w-14 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
        <Trophy size={24} />
      </div>
      <h1 className="font-display text-2xl">Famous games</h1>
      <p className="text-ink-muted text-sm leading-relaxed max-w-md">
        Immortal, Evergreen, Opera Game, Kasparov–Topalov &lsquo;99, the World Championship matches, AlphaZero–Stockfish — coming soon, each with a backstory, move-by-move notes, and key moments to jump to.
      </p>
      <Link to="/" className="btn-ghost text-xs gap-1">
        <ArrowLeft size={12} /> Back home
      </Link>
    </div>
  );
}
