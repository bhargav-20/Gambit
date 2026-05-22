import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OPENING_CATEGORIES, OPENINGS } from './catalog';
import type { Opening } from './catalog';
import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { Search, BookOpen } from 'lucide-react';
import clsx from 'clsx';

export function OpeningsPanel() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Opening['category'] | 'All'>('All');
  const currentId = useGameStore((s) => s.game.meta.openingId);
  const navigate = useNavigate();
  const setMobileSheet = useUiStore((s) => s.setMobileSheet);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return OPENINGS.filter((o) => {
      if (category !== 'All' && o.category !== category) return false;
      if (!q) return true;
      return (
        o.name.toLowerCase().includes(q) ||
        o.eco.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      );
    });
  }, [query, category]);

  const pick = (o: Opening) => {
    // URL is now the source of truth — the route loads the PGN. This keeps
    // the back/forward buttons sensible and lets users share specific
    // openings directly.
    navigate(`/openings/${o.id}`);
    // Close the mobile catalog sheet (if it's open) so the user lands on
    // the board after picking.
    setMobileSheet(null);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <BookOpen size={16} className="text-accent" />
        <h2 className="font-display text-lg">Openings</h2>
        <span className="chip ml-auto">{OPENINGS.length}</span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          className="input pl-8"
          placeholder="Search by name, ECO, idea…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <CategoryChip label="All" active={category === 'All'} onClick={() => setCategory('All')} />
        {OPENING_CATEGORIES.map((c) => (
          <CategoryChip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1 flex flex-col gap-1.5">
        {filtered.map((o) => {
          const active = o.id === currentId;
          return (
            <button
              key={o.id}
              onClick={() => pick(o)}
              className={clsx(
                'text-left rounded-lg border px-3 py-2.5 transition-colors group',
                active
                  ? 'border-accent/50 bg-accent/10'
                  : 'border-edge bg-bg-raised hover:border-edge-strong hover:bg-bg-subtle',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={clsx('font-medium', active ? 'text-accent' : 'text-ink')}>
                  {o.name}
                </span>
                <span className="font-mono text-[10px] text-ink-faint">{o.eco}</span>
              </div>
              <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{o.description}</p>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-ink-faint text-sm py-8">No openings match.</div>
        )}
      </div>
    </div>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full px-2.5 py-0.5 text-xs border transition-colors',
        active
          ? 'border-accent/50 text-accent bg-accent/10'
          : 'border-edge text-ink-muted hover:border-edge-strong',
      )}
    >
      {label}
    </button>
  );
}
