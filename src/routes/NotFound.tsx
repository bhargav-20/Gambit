import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export function NotFound() {
  return (
    <div className="w-full max-w-md mx-auto p-6 sm:p-10 flex flex-col items-center text-center gap-3">
      <div className="font-display text-5xl text-ink-faint">404</div>
      <p className="text-ink-muted text-sm">No such page in this sandbox.</p>
      <Link to="/" className="btn-primary text-xs gap-1.5 mt-1">
        <Home size={12} /> Go home
      </Link>
    </div>
  );
}
