import { useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { useNarrationStore } from '@/core/store/narrationStore';
import { exportGameToVideo } from './exportVideo';
import type { Aspect, Quality } from './exportVideo';
import { generateNarration } from './narration';
import { findOpening } from '@/features/openings/catalog';
import { findGame } from '@/features/games/catalog';
import { Download, Smartphone, Monitor, Square, Video, Loader2, Zap, Gem, Mic } from 'lucide-react';
import clsx from 'clsx';
import { NarrationPreview } from './NarrationPreview';

const ASPECTS: Array<{ id: Aspect; label: string; icon: React.ReactNode; sub: string }> = [
  { id: 'portrait', label: 'Portrait', icon: <Smartphone size={14} />, sub: '1080×1920 — Reels / TikTok' },
  { id: 'landscape', label: 'Landscape', icon: <Monitor size={14} />, sub: '1920×1080 — YouTube' },
  { id: 'square', label: 'Square', icon: <Square size={14} />, sub: '1080×1080 — Instagram' },
];

const QUALITIES: Array<{ id: Quality; label: string; icon: React.ReactNode; sub: string }> = [
  { id: 'fast', label: 'Fast', icon: <Zap size={14} />, sub: 'MediaRecorder · WebM · real-time' },
  { id: 'high', label: 'High quality', icon: <Gem size={14} />, sub: 'ffmpeg · MP4 H.264 · plays everywhere' },
];

export function ExportPanel() {
  const [aspect, setAspect] = useState<Aspect>('portrait');
  const [quality, setQuality] = useState<Quality>('fast');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; extension: string } | null>(null);

  const game = useGameStore((s) => s.game);
  const orientation = useGameStore((s) => s.orientation);
  const themeId = useUiStore((s) => s.boardTheme);
  const pieceSetId = useUiStore((s) => s.pieceSet);

  // Narration config (lives in narrationStore so NarrationPreview can
  // surface and edit the same picker state).
  const narration = useNarrationStore();
  // Narrated export requires the neural voice (system voice can't be
  // captured) and the high-quality ffmpeg backend.
  const narratedExportPossible = narration.voiceKind === 'neural' && !!narration.voiceId;
  const includeNarration = narration.exportNarration && narratedExportPossible;
  const effectiveQuality: Quality = includeNarration ? 'high' : quality;

  const canExport = game.moves.length > 0;

  const run = async () => {
    if (!canExport) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    try {
      // Assemble the narration option lazily — we only generate the
      // script when the user actually opts in, so loading a game doesn't
      // spend CPU walking through the openings/games catalogs.
      let narrationOpts: Parameters<typeof exportGameToVideo>[1]['narration'];
      if (includeNarration) {
        const opening = game.meta.openingId ? findOpening(game.meta.openingId) : undefined;
        const famous = game.meta.gameId ? findGame(game.meta.gameId) : undefined;
        const script = generateNarration({ game, opening, famousGame: famous });
        narrationOpts = {
          script,
          voice: narration.voiceId,
          music: narration.musicBlob ?? undefined,
          voiceVolume: narration.voiceVolume,
          musicVolume: narration.musicVolume,
          autoDuck: narration.autoDuck,
        };
      }
      const res = await exportGameToVideo(game, {
        aspect,
        themeId,
        pieceSetId,
        orientation,
        title: game.meta.title,
        subtitle: game.meta.eco ? `ECO ${game.meta.eco}` : game.meta.description,
        quality: effectiveQuality,
        narration: narrationOpts,
        onProgress: setProgress,
      });
      const url = URL.createObjectURL(res.blob);
      setPreview({ url, extension: res.extension });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview.url;
    const slug = game.meta.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    a.download = `${slug || 'game'}-${aspect}.${preview.extension}`;
    a.click();
  };

  const isHigh = effectiveQuality === 'high';
  // The narrated path has three phases the busy label communicates so
  // the user knows synthesis is the slow step (not a hung process):
  //   0..0.5  → synthesizing speech per line
  //   0.5..0.85 → rendering frames
  //   0.85..1.0 → ffmpeg encoding
  const busyLabel = busy
    ? includeNarration
      ? progress < 0.5
        ? `Synthesizing speech… ${Math.round((progress / 0.5) * 100)}%`
        : progress < 0.85
          ? `Rendering frames… ${Math.round(((progress - 0.5) / 0.35) * 100)}%`
          : `Encoding MP4… ${Math.round(((progress - 0.85) / 0.15) * 100)}%`
      : isHigh
        ? progress < 0.7
          ? `Rendering frames… ${Math.round((progress / 0.7) * 100)}%`
          : `Encoding MP4… ${Math.round(((progress - 0.7) / 0.3) * 100)}%`
        : `Rendering… ${Math.round(progress * 100)}%`
    : includeNarration ? 'Render narrated video' : 'Render video';

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Video size={16} className="text-accent" />
        <h2 className="font-display text-lg">Export Video</h2>
      </div>

      <div className="flex flex-col gap-2">
        <span className="label">Aspect</span>
        <div className="grid grid-cols-3 gap-2">
          {ASPECTS.map((a) => (
            <button
              key={a.id}
              onClick={() => setAspect(a.id)}
              className={clsx(
                'rounded-lg border p-2 text-left transition-colors',
                aspect === a.id ? 'border-accent/60 bg-accent/10' : 'border-edge hover:border-edge-strong',
              )}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {a.icon} {a.label}
              </div>
              <div className="text-[10px] text-ink-faint mt-1">{a.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="label">Quality</span>
        <div className="grid grid-cols-2 gap-2">
          {QUALITIES.map((q) => (
            <button
              key={q.id}
              onClick={() => setQuality(q.id)}
              className={clsx(
                'rounded-lg border p-2 text-left transition-colors',
                quality === q.id ? 'border-accent/60 bg-accent/10' : 'border-edge hover:border-edge-strong',
              )}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                {q.icon} {q.label}
              </div>
              <div className="text-[10px] text-ink-faint mt-1">{q.sub}</div>
            </button>
          ))}
        </div>
        {isHigh && (
          <p className="text-[11px] text-ink-faint">
            First high-quality render downloads ~32 MB of ffmpeg core (cached after). Encoding runs ~3–5× real-time.
          </p>
        )}
      </div>

      {/* Narration preview — Phase 1a/1b/1c. The picker + mix controls
          live here; the Render-with-narration toggle below this component
          shares the same config via narrationStore. */}
      <NarrationPreview />

      {/* Narration export toggle. Gated to the neural-voice path:
          SpeechSynthesis audio can't be captured, so an OS voice can
          preview but not export. */}
      {game.moves.length > 0 && (
        <label className={clsx(
          'panel-tight p-2.5 flex items-start gap-2.5 cursor-pointer transition-colors',
          includeNarration ? 'border-accent/40 bg-accent/5' : '',
        )}>
          <input
            type="checkbox"
            className="accent-accent mt-0.5"
            checked={narration.exportNarration}
            onChange={(e) => narration.setExportNarration(e.target.checked)}
            disabled={!narratedExportPossible}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-medium">
              <Mic size={12} className="text-accent" />
              Include narration in the exported video
            </div>
            <p className="text-[10px] text-ink-faint mt-1 leading-relaxed">
              {narratedExportPossible
                ? 'Forces High-quality (ffmpeg) backend. Synthesis happens before render — expect minutes of "Synthesizing speech…" for long games.'
                : 'Pick a Neural voice above to enable. System voices can preview but their audio can\'t be captured.'}
            </p>
          </div>
        </label>
      )}

      <button
        className="btn-primary"
        onClick={run}
        disabled={!canExport || busy}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
        {busyLabel}
      </button>

      {!canExport && (
        <p className="text-xs text-ink-faint -mt-2">Load an opening or PGN first.</p>
      )}

      {error && <p className="text-xs text-bad">{error}</p>}

      {preview && (
        <div className="flex flex-col gap-2">
          <video
            src={preview.url}
            controls
            className="w-full rounded-lg border border-edge bg-bg"
            style={{ maxHeight: 480 }}
          />
          <button className="btn-primary" onClick={download}>
            <Download size={14} /> Download .{preview.extension}
          </button>
        </div>
      )}
    </div>
  );
}
