import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { GAMES, GAME_ERAS } from './catalog';
import type { FamousGame, GameEra } from './catalog';
import { Trophy, Search } from 'lucide-react';
import clsx from 'clsx';

/**
 * The famous-games catalog. Drives both the full-page /games landing and the
 * mobile bottom-sheet on /games/:id. Filters: free-text search (matches
 * title, players, tags), era chips, and a result chip group.
 *
 * Layout mirrors OpeningsPanel — same row shape, same hover/active behavior
 * — so a user moving between catalogs has no relearning cost.
 */
export function GamesCatalog() {
  const [query, setQuery] = useState('');
  const [era, setEra] = useState<GameEra | 'all'>('all');
  const [tag, setTag] = useState<string | null>(null);
  const currentId = useGameStore((s) => s.game.meta.gameId);
  const navigate = useNavigate();
  const setMobileSheet = useUiStore((s) => s.setMobileSheet);

  // Collect every distinct tag across the catalog, sorted alphabetically.
  // Memoized on GAMES (effectively constant) — recomputed only when the
  // catalog itself grows, never on user input.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    for (const g of GAMES) for (const t of g.tags) set.add(t);
    return [...set].sort();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return GAMES.filter((g) => {
      if (era !== 'all' && g.era !== era) return false;
      if (tag && !g.tags.includes(tag)) return false;
      if (!q) return true;
      return (
        g.title.toLowerCase().includes(q) ||
        g.players.white.toLowerCase().includes(q) ||
        g.players.black.toLowerCase().includes(q) ||
        g.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [query, era, tag]);

  const pick = (g: FamousGame) => {
    navigate(`/games/${g.id}`);
    setMobileSheet(null);
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
        <Trophy size={16} className="text-accent" />
        <h2 className="font-display text-lg">Famous games</h2>
        <span className="chip ml-auto">{GAMES.length}</span>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          className="input pl-8"
          placeholder="Search by title, player, tag…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        <EraChip label="All" active={era === 'all'} onClick={() => setEra('all')} />
        {GAME_ERAS.map((e) => (
          <EraChip
            key={e.id}
            label={e.label}
            sublabel={e.years}
            active={era === e.id}
            onClick={() => setEra(e.id)}
          />
        ))}
      </div>

      {/* Tag chips — secondary filter, intentionally smaller than the era
          row so the primary axis (when in chess history) stays visually
          dominant. Clicking the active tag clears it; otherwise toggles. */}
      <div className="flex flex-wrap gap-1">
        {allTags.map((t) => (
          <button
            key={t}
            onClick={() => setTag(tag === t ? null : t)}
            className={clsx(
              'rounded-full px-2 py-0.5 text-[10px] border transition-colors',
              tag === t
                ? 'border-accent/60 text-accent bg-accent/10'
                : 'border-edge text-ink-faint hover:border-edge-strong hover:text-ink-muted',
            )}
          >
            {t}
          </button>
        ))}
        {tag && (
          <button
            onClick={() => setTag(null)}
            className="rounded-full px-2 py-0.5 text-[10px] text-ink-muted hover:text-ink"
            title="Clear tag filter"
          >
            ✕ clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto pr-1 -mr-1 flex flex-col gap-1.5">
        {filtered.map((g) => {
          const active = g.id === currentId;
          return (
            <button
              key={g.id}
              onClick={() => pick(g)}
              className={clsx(
                'text-left rounded-lg border px-3 py-2.5 transition-colors group',
                active
                  ? 'border-accent/50 bg-accent/10'
                  : 'border-edge bg-bg-raised hover:border-edge-strong hover:bg-bg-subtle',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={clsx('font-medium', active ? 'text-accent' : 'text-ink')}>
                  {g.title}
                </span>
                <ResultBadge result={g.result} />
              </div>
              <p className="text-xs text-ink-muted mt-0.5 truncate">
                {g.players.white} <span className="text-ink-faint">vs</span> {g.players.black}
                {g.date && <span className="text-ink-faint"> · {g.date.slice(0, 4)}</span>}
              </p>
              {g.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {g.tags.slice(0, 3).map((t) => (
                    <span key={t} className="chip text-[9px] px-1.5 py-0">{t}</span>
                  ))}
                </div>
              )}
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center text-ink-faint text-sm py-8">No games match.</div>
        )}
      </div>
    </div>
  );
}

function EraChip({ label, sublabel, active, onClick }: { label: string; sublabel?: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full px-2.5 py-0.5 text-xs border transition-colors flex items-center gap-1.5',
        active
          ? 'border-accent/50 text-accent bg-accent/10'
          : 'border-edge text-ink-muted hover:border-edge-strong',
      )}
      title={sublabel}
    >
      {label}
    </button>
  );
}

function ResultBadge({ result }: { result: '1-0' | '0-1' | '1/2-1/2' }) {
  const cls =
    result === '1-0'
      ? 'text-ink border-edge-strong'
      : result === '0-1'
        ? 'text-ink-muted border-edge'
        : 'text-warn border-warn/40';
  return (
    <span className={clsx('font-mono text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border', cls)}>
      {result === '1/2-1/2' ? '½–½' : result}
    </span>
  );
}
