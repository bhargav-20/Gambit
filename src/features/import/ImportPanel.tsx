import { useRef, useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { Upload, ClipboardPaste, Link2, Check, Globe, Loader2, Pencil } from 'lucide-react';
import { gameToPgn } from '@/core/chess/pgn';
import { fetchGameFromUrl, detectProvider } from './urlImport';

export function ImportPanel() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const loadFromPgn = useGameStore((s) => s.loadFromPgn);
  const startComposition = useGameStore((s) => s.startComposition);
  const game = useGameStore((s) => s.game);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleUrlLoad = async () => {
    if (!url.trim()) {
      setUrlError('Paste a Lichess or Chess.com game URL.');
      return;
    }
    setUrlBusy(true);
    setUrlError(null);
    try {
      const result = await fetchGameFromUrl(url);
      const loadRes = loadFromPgn(result.pgn, {
        source: 'paste',
        title: result.title,
      });
      if (!loadRes.ok) setUrlError(loadRes.error);
    } catch (e) {
      setUrlError((e as Error).message);
    } finally {
      setUrlBusy(false);
    }
  };

  const detectedProvider = url.trim() ? detectProvider(url.trim()) : null;

  const handleLoad = () => {
    if (!text.trim()) {
      setError('Paste a PGN first.');
      return;
    }
    const res = loadFromPgn(text, { source: 'paste' });
    if (!res.ok) setError(res.error);
    else setError(null);
  };

  const handleFile = async (file: File) => {
    const t = await file.text();
    setText(t);
    const res = loadFromPgn(t, { source: 'upload', title: file.name.replace(/\.pgn$/i, '') });
    if (!res.ok) setError(res.error);
    else setError(null);
  };

  const shareUrl = () => {
    const pgn = game.moves.length ? gameToPgn(game) : '';
    if (!pgn) return null;
    const url = new URL(window.location.href);
    url.hash = `pgn=${encodeURIComponent(pgn)}`;
    return url.toString();
  };

  const copyShare = async () => {
    const url = shareUrl();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <ClipboardPaste size={16} className="text-accent" />
        <h2 className="font-display text-lg">Import / Compose</h2>
      </div>

      <div className="flex flex-col gap-2">
        <span className="label">From URL</span>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="lichess.org/... or chess.com/game/..."
              className="input pl-8"
              spellCheck={false}
            />
          </div>
          <button
            className="btn-primary"
            onClick={handleUrlLoad}
            disabled={urlBusy || !url.trim()}
          >
            {urlBusy ? <Loader2 size={14} className="animate-spin" /> : 'Fetch'}
          </button>
        </div>
        {detectedProvider && (
          <p className="text-[10px] text-ink-faint">Detected: {detectedProvider === 'lichess' ? 'Lichess' : 'Chess.com'}</p>
        )}
        {urlError && <p className="text-xs text-bad">{urlError}</p>}
      </div>

      <div className="divider" />

      <div className="flex flex-col gap-2">
        <span className="label">Paste PGN</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 …`}
          className="input min-h-[140px] font-mono text-xs leading-relaxed resize-y"
          spellCheck={false}
        />
        {error && <p className="text-xs text-bad">{error}</p>}
        <div className="flex gap-2">
          <button className="btn-primary flex-1" onClick={handleLoad}>Load PGN</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            <Upload size={14} /> File
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pgn,text/plain"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      <div className="divider" />

      <div className="flex flex-col gap-2">
        <span className="label">Free play</span>
        <p className="text-xs text-ink-muted">
          Start a fresh composition from the standard starting position. Edit is always on, the engine is available, and Undo pops the last move.
        </p>
        <button className="btn-primary" onClick={startComposition}>
          <Pencil size={14} /> Start new composition
        </button>
        <p className="text-[10px] text-ink-faint">
          You can also enter composer from any opening — scrub to the position you like and hit
          <span className="text-ink"> Compose from here </span>
          near the playback controls.
        </p>
      </div>

      <div className="divider" />

      <div className="flex flex-col gap-2">
        <span className="label">Share</span>
        <button className="btn" onClick={copyShare} disabled={game.moves.length === 0}>
          {copied ? <Check size={14} /> : <Link2 size={14} />}
          {copied ? 'Link copied' : 'Copy share link'}
        </button>
        <p className="text-xs text-ink-faint">Encodes the moveset in the URL hash — no server needed.</p>
      </div>
    </div>
  );
}
