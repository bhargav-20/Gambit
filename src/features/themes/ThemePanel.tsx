import { useUiStore } from '@/core/store/uiStore';
import type { PieceSetId } from '@/core/store/uiStore';
import { BOARD_THEMES } from './boardThemes';
import { PIECE_SETS, findPieceSet } from './piecesets';
import { APP_BACKGROUNDS } from './appBackgrounds';
import { Palette, Eye, Square, Gauge, Box, Crown, Image as ImageIcon } from 'lucide-react';
import clsx from 'clsx';

export function ThemePanel() {
  const ui = useUiStore();
  return (
    <div className="flex flex-col gap-5 h-full overflow-y-auto pr-1 -mr-1">
      <div className="flex items-center gap-2">
        <Palette size={16} className="text-accent" />
        <h2 className="font-display text-lg">Theme & Display</h2>
      </div>

      <Section icon={<ImageIcon size={14} />} title="Background">
        <div className="grid grid-cols-2 gap-2">
          {APP_BACKGROUNDS.map((b) => (
            <button
              key={b.id}
              onClick={() => ui.setAppBackground(b.id)}
              className={clsx(
                'rounded-xl border p-2 transition-colors text-left',
                ui.appBackground === b.id
                  ? 'border-accent/60 bg-accent/5'
                  : 'border-edge hover:border-edge-strong',
              )}
              title={b.description}
            >
              <div
                className="aspect-[16/9] w-full rounded-md mb-1.5 border border-edge"
                style={{
                  backgroundColor: b.base,
                  backgroundImage: b.previewImage,
                  backgroundSize: b.previewSize ?? 'auto',
                }}
              />
              <div className="text-xs font-medium">{b.label}</div>
              <div className="text-[10px] text-ink-faint leading-tight mt-0.5">{b.description}</div>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-ink-faint mt-1">
          The background fills the app behind every page — most visible on Home and the catalog landings.
        </p>
      </Section>

      <Section icon={<Square size={14} />} title="Board theme">
        <div className="grid grid-cols-2 gap-2">
          {BOARD_THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => ui.setBoardTheme(t.id)}
              className={clsx(
                'rounded-xl border p-2 transition-colors',
                ui.boardTheme === t.id
                  ? 'border-accent/60 bg-accent/5'
                  : 'border-edge hover:border-edge-strong',
              )}
            >
              <div
                className="aspect-square w-full rounded-md overflow-hidden mb-1.5"
                style={{
                  background: `
                    linear-gradient(45deg,
                      ${t.dark} 25%, transparent 25%, transparent 75%,
                      ${t.dark} 75%, ${t.dark}),
                    linear-gradient(45deg,
                      ${t.dark} 25%, ${t.light} 25%, ${t.light} 75%,
                      ${t.dark} 75%, ${t.dark})`,
                  backgroundPosition: '0 0, 6px 6px',
                  backgroundSize: '12px 12px',
                }}
              />
              <div className="text-xs text-center">{t.label}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section icon={<Crown size={14} />} title="Piece set">
        <div className="grid grid-cols-3 gap-2">
          {PIECE_SETS.map((set) => (
            <PieceSetCard
              key={set.id}
              setId={set.id as PieceSetId}
              active={ui.pieceSet === set.id}
              onClick={() => ui.setPieceSet(set.id as PieceSetId)}
            />
          ))}
        </div>
        <p className="text-xs text-ink-faint mt-2">
          {findPieceSet(ui.pieceSet).attribution}
        </p>
      </Section>

      <Section icon={<Box size={14} />} title="Rendering">
        <div className="grid grid-cols-2 gap-2">
          <Toggle
            label="2D"
            active={ui.renderMode === '2d'}
            onClick={() => ui.setRenderMode('2d')}
          />
          <Toggle
            label="3D (preview)"
            active={ui.renderMode === '3d'}
            onClick={() => ui.setRenderMode('3d')}
          />
        </div>
        <p className="text-xs text-ink-faint mt-2">
          3D preview ships with a low-poly board. Photoreal pieces are on the roadmap.
        </p>
      </Section>

      <Section icon={<Eye size={14} />} title="Overlays">
        <Switch label="Show coordinates" value={ui.showCoords} onChange={ui.setShowCoords} />
        <Switch label="Highlight last move" value={ui.showLastMove} onChange={ui.setShowLastMove} />
        <Switch label="Legal-move dots (edit mode)" value={ui.showLegalDots} onChange={ui.setShowLegalDots} />
        <p className="text-[10px] text-ink-faint pl-0.5">
          Engine analysis lives in its own sandbox — click "Analyze this position" near the playback controls.
        </p>
      </Section>

      <Section icon={<Gauge size={14} />} title="Animation">
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={0}
            max={600}
            step={20}
            value={ui.animationMs}
            onChange={(e) => ui.setAnimationMs(Number(e.target.value))}
            className="flex-1 accent-accent"
          />
          <span className="font-mono text-xs tabular-nums w-12 text-right">{ui.animationMs}ms</span>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-ink-muted">
        {icon}
        <span className="label">{title}</span>
      </div>
      {children}
    </div>
  );
}

function PieceSetCard({ setId, active, onClick }: { setId: PieceSetId; active: boolean; onClick: () => void }) {
  const set = findPieceSet(setId);
  const previewCodes: Array<'wK' | 'wN' | 'bQ'> = ['wK', 'wN', 'bQ'];
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-xl border p-2 transition-colors flex flex-col items-center gap-1',
        active ? 'border-accent/60 bg-accent/5' : 'border-edge hover:border-edge-strong',
      )}
    >
      <div className="flex items-center justify-around w-full bg-bg-subtle rounded-md py-1.5 px-1">
        {previewCodes.map((code) => (
          <img
            key={code}
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(set.pieces[code])}`}
            alt={code}
            className="h-7 w-7"
          />
        ))}
      </div>
      <div className="text-xs">{set.label}</div>
    </button>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-lg border px-3 py-2 text-sm transition-colors',
        active ? 'border-accent text-accent bg-accent/10' : 'border-edge hover:border-edge-strong',
      )}
    >
      {label}
    </button>
  );
}

function Switch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className="w-full flex items-center justify-between text-sm py-1.5 px-0.5 cursor-pointer group"
    >
      <span className={clsx('transition-colors', value ? 'text-ink' : 'text-ink-muted')}>
        {label}
      </span>
      <span
        className={clsx(
          'relative inline-block h-[22px] w-10 rounded-full transition-colors shrink-0',
          value
            ? 'bg-accent shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)]'
            : 'bg-bg-subtle border border-edge group-hover:border-edge-strong',
        )}
      >
        <span
          className={clsx(
            'absolute top-1/2 -translate-y-1/2 h-[18px] w-[18px] rounded-full shadow-md transition-all duration-150',
            value
              ? 'left-[20px] bg-white'
              : 'left-[2px] bg-ink-muted',
          )}
        />
      </span>
    </button>
  );
}
