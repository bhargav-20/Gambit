import { useGameStore } from '@/core/store/gameStore';
import { findOpening } from './catalog';
import { BookOpen, ChevronRight, Lightbulb } from 'lucide-react';

/**
 * Surfaces the strategic idea behind the currently-loaded opening: the broad
 * concept, plans for each side, typical pawn structures. Falls back to a
 * gentle empty state when the loaded game wasn't picked from the catalog.
 */
export function IdeaPanel() {
  const meta = useGameStore((s) => s.game.meta);
  const opening = meta.openingId ? findOpening(meta.openingId) : undefined;

  if (!opening) {
    return (
      <div className="panel p-5 h-full flex flex-col items-center justify-center text-center text-ink-muted">
        <BookOpen size={28} className="text-ink-faint mb-3" />
        <p className="text-sm">No opening idea available</p>
        <p className="text-xs text-ink-faint mt-1.5 max-w-[240px]">
          {meta.source === 'opening'
            ? 'This opening has no commentary yet.'
            : 'Pick a preset opening to see its strategic idea, plans, and typical structures.'}
        </p>
      </div>
    );
  }

  return (
    <div className="panel p-4 h-full overflow-y-auto">
      <div className="flex items-start gap-2 mb-4">
        <Lightbulb size={16} className="text-accent shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base leading-tight">{opening.name}</h3>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-accent">{opening.eco}</span>
            <span className="text-[10px] text-ink-faint uppercase tracking-wider">{opening.category}</span>
          </div>
        </div>
      </div>

      <Section label="The idea">
        <p className="text-sm leading-relaxed text-ink">{opening.idea}</p>
      </Section>

      <Section label="White's plan" tone="white">
        <p className="text-sm leading-relaxed text-ink">{opening.whitePlan}</p>
      </Section>

      <Section label="Black's plan" tone="black">
        <p className="text-sm leading-relaxed text-ink">{opening.blackPlan}</p>
      </Section>

      {opening.structures && (
        <Section label="Typical structures">
          <p className="text-sm leading-relaxed text-ink">{opening.structures}</p>
        </Section>
      )}

      {opening.continuation && (
        <Section label="After the named line">
          <p className="text-sm leading-relaxed text-ink">{opening.continuation}</p>
        </Section>
      )}

      {opening.criticalIdeas && opening.criticalIdeas.length > 0 && (
        <Section label="Critical ideas">
          <ul className="space-y-1.5 text-sm leading-relaxed text-ink">
            {opening.criticalIdeas.map((idea, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-accent shrink-0">▸</span>
                <span>{idea}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  label,
  tone,
  children,
}: {
  label: string;
  tone?: 'white' | 'black';
  children: React.ReactNode;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="flex items-center gap-1.5 mb-1.5">
        {tone && (
          <span
            className="inline-block h-2.5 w-2.5 rounded-sm border border-edge-strong"
            style={{
              background: tone === 'white' ? '#f3eada' : '#1c1c20',
            }}
          />
        )}
        <span className="label">{label}</span>
        <ChevronRight size={10} className="text-ink-faint" />
      </div>
      {children}
    </div>
  );
}
