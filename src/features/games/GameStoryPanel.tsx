import { useGameStore } from '@/core/store/gameStore';
import { findGame } from './catalog';
import { Trophy, Crown, Calendar, MapPin, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

/**
 * The "story" panel for a loaded famous game. Splits into:
 *
 *   - Header: title, players + Elo, event/date/site/result
 *   - Narrative: 2–4 paragraphs about what was at stake and why famous
 *   - Key moments: clickable list — each row jumps the board to that ply
 *   - Outcome: closing paragraph
 *
 * Reads the loaded game's `meta.gameId` to look up its FamousGame entry;
 * if no game is loaded or it's not from the catalog, renders an empty state.
 */
export function GameStoryPanel() {
  const gameId = useGameStore((s) => s.game.meta.gameId);
  const goTo = useGameStore((s) => s.goTo);
  const currentPly = useGameStore((s) => s.ply);
  const game = gameId ? findGame(gameId) : undefined;

  if (!game) {
    return (
      <div className="text-center text-ink-muted text-sm py-8 px-4">
        Pick a game from the catalog to read its backstory.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full overflow-y-auto pr-1 -mr-1">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-start gap-2">
          <Trophy size={16} className="text-accent shrink-0 mt-1" />
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg leading-tight">{game.title}</h2>
            <p className="text-xs text-ink-muted mt-0.5">
              <PlayerName name={game.players.white} elo={game.players.whiteElo} />
              <span className="text-ink-faint mx-1.5">vs</span>
              <PlayerName name={game.players.black} elo={game.players.blackElo} />
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-1">
          {game.date && <MetaChip icon={<Calendar size={10} />} text={game.date} />}
          {game.site && <MetaChip icon={<MapPin size={10} />} text={game.site} />}
          {game.event && <MetaChip icon={<Crown size={10} />} text={game.event + (game.round ? ` · Round ${game.round}` : '')} />}
          <ResultChip result={game.result} />
        </div>
      </header>

      {game.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {game.tags.map((t) => (
            <span key={t} className="chip-accent text-[10px]">{t}</span>
          ))}
        </div>
      )}

      <section>
        <div className="label mb-2">About this game</div>
        <div className="prose prose-invert text-sm text-ink leading-relaxed space-y-2.5">
          {splitParagraphs(game.narrative).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      </section>

      {game.keyMoments.length > 0 && (
        <section>
          <div className="label mb-2">Key moments</div>
          <ul className="flex flex-col gap-1">
            {game.keyMoments.map((km) => (
              <li key={km.ply}>
                <button
                  onClick={() => goTo(km.ply)}
                  className={clsx(
                    'w-full text-left rounded-md border px-2.5 py-2 text-xs flex items-start gap-2 transition-colors',
                    currentPly === km.ply
                      ? 'border-accent/50 bg-accent/10 text-accent'
                      : 'border-edge bg-bg-raised hover:border-edge-strong hover:bg-bg-subtle text-ink',
                  )}
                >
                  <ChevronRight size={11} className="shrink-0 mt-0.5" />
                  <span className="leading-snug">{km.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="label mb-2">Outcome</div>
        <p className="text-sm text-ink leading-relaxed">{game.outcome}</p>
      </section>
    </div>
  );
}

function PlayerName({ name, elo }: { name: string; elo?: number }) {
  return (
    <span className="text-ink">
      {name}
      {elo && <span className="text-ink-faint ml-1">({elo})</span>}
    </span>
  );
}

function MetaChip({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <span className="chip text-[10px] gap-1">
      <span className="text-ink-faint">{icon}</span>
      {text}
    </span>
  );
}

function ResultChip({ result }: { result: '1-0' | '0-1' | '1/2-1/2' }) {
  const label = result === '1/2-1/2' ? '½–½' : result;
  return (
    <span className="chip text-[10px] font-mono border-accent/30 text-accent">
      {label}
    </span>
  );
}

/**
 * Split a narrative string into paragraphs at blank-line boundaries, robust
 * to either \n\n or actual hard returns from the source file. Each paragraph
 * is trimmed; empty ones are dropped.
 */
function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}
