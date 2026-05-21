import { useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { exportGameToVideo } from './exportVideo';
import type { Aspect } from './exportVideo';
import { Download, Smartphone, Monitor, Square, Video, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const ASPECTS: Array<{ id: Aspect; label: string; icon: React.ReactNode; sub: string }> = [
  { id: 'portrait', label: 'Portrait', icon: <Smartphone size={14} />, sub: '1080×1920 — Reels / TikTok' },
  { id: 'landscape', label: 'Landscape', icon: <Monitor size={14} />, sub: '1920×1080 — YouTube' },
  { id: 'square', label: 'Square', icon: <Square size={14} />, sub: '1080×1080 — Instagram' },
];

export function ExportPanel() {
  const [aspect, setAspect] = useState<Aspect>('portrait');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; extension: string } | null>(null);

  const game = useGameStore((s) => s.game);
  const orientation = useGameStore((s) => s.orientation);
  const themeId = useUiStore((s) => s.boardTheme);
  const pieceSetId = useUiStore((s) => s.pieceSet);

  const canExport = game.moves.length > 0;

  const run = async () => {
    if (!canExport) return;
    setBusy(true);
    setError(null);
    setProgress(0);
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    try {
      const res = await exportGameToVideo(game, {
        aspect,
        themeId,
        pieceSetId,
        orientation,
        title: game.meta.title,
        subtitle: game.meta.eco ? `ECO ${game.meta.eco}` : game.meta.description,
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

      <div className="panel-tight p-3 text-xs text-ink-muted">
        Currently uses <code className="text-ink">MediaRecorder</code> — fast, browser-native.
        High-quality MP4 via <code className="text-ink">ffmpeg.wasm</code> is on the roadmap.
      </div>

      <button
        className="btn-primary"
        onClick={run}
        disabled={!canExport || busy}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Video size={14} />}
        {busy ? `Rendering… ${Math.round(progress * 100)}%` : 'Render video'}
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
