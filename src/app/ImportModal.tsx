import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { X, Upload, Loader2, Globe, ClipboardPaste, PlusSquare, AlertCircle } from 'lucide-react';
import clsx from 'clsx';
import { useGameStore } from '@/core/store/gameStore';
import { loadEmpty, STARTPOS } from '@/core/chess/pgn';
import { fetchGameFromUrl, detectProvider } from '@/features/import/urlImport';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Universal "get a position in" modal. Four entry paths — paste PGN, URL fetch
 * (Lichess / Chess.com), paste FEN, and start from an empty board. All of them
 * end the same way: the game loads and we navigate to /analyze so the user is
 * immediately in the surface that supports playing/branching.
 *
 * Lives at the AppShell level so any route can open it via the TopBar Import
 * icon. The modal cleans up its own state on close so reopening starts fresh.
 */
export function ImportModal({ open, onClose }: Props) {
  const navigate = useNavigate();
  const loadFromPgn = useGameStore((s) => s.loadFromPgn);
  const loadGame = useGameStore((s) => s.loadGame);

  const [pgn, setPgn] = useState('');
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [urlBusy, setUrlBusy] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [fen, setFen] = useState('');
  const [fenError, setFenError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset everything on close so a re-open is clean.
  useEffect(() => {
    if (!open) {
      setPgn('');
      setPgnError(null);
      setUrl('');
      setUrlError(null);
      setUrlBusy(false);
      setFen('');
      setFenError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // After a successful import, jump to Analyze so the user can play/branch.
  // Done in one place because every entry path ends the same way.
  const finish = () => {
    onClose();
    navigate('/analyze');
  };

  const submitPgn = () => {
    if (!pgn.trim()) {
      setPgnError('Paste a PGN first.');
      return;
    }
    const res = loadFromPgn(pgn, { source: 'paste' });
    if (!res.ok) {
      setPgnError(res.error);
      return;
    }
    finish();
  };

  const submitFile = async (file: File) => {
    const text = await file.text();
    const res = loadFromPgn(text, { source: 'upload', title: file.name.replace(/\.pgn$/i, '') });
    if (!res.ok) {
      setPgnError(res.error);
      return;
    }
    finish();
  };

  const submitUrl = async () => {
    if (!url.trim()) {
      setUrlError('Paste a Lichess or Chess.com game URL.');
      return;
    }
    setUrlBusy(true);
    setUrlError(null);
    try {
      const result = await fetchGameFromUrl(url);
      const res = loadFromPgn(result.pgn, { source: 'url', title: result.title });
      if (!res.ok) {
        setUrlError(res.error);
      } else {
        finish();
      }
    } catch (e) {
      setUrlError((e as Error).message);
    } finally {
      setUrlBusy(false);
    }
  };

  const submitFen = () => {
    const trimmed = fen.trim();
    if (!trimmed) {
      setFenError('Paste a FEN first.');
      return;
    }
    // Validate with chess.js — `new Chess(fen)` throws on invalid FEN.
    try {
      new Chess(trimmed);
    } catch (e) {
      setFenError((e as Error).message);
      return;
    }
    loadGame(loadEmpty(trimmed, { title: 'Custom position', source: 'editor' }));
    finish();
  };

  const submitEmpty = () => {
    loadGame(loadEmpty(STARTPOS, { title: 'Fresh board', source: 'editor' }));
    finish();
  };

  const detectedProvider = url.trim() ? detectProvider(url.trim()) : null;

  return (
    <div
      className={clsx(
        'fixed inset-0 z-50 transition-opacity flex items-center justify-center p-3 sm:p-6',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-sm cursor-default"
        aria-label="Close import"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <div
        className={clsx(
          'relative panel w-full sm:max-w-lg max-h-full flex flex-col',
          'transition-transform duration-200',
          open ? 'scale-100' : 'scale-95',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Import a game"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-edge shrink-0">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-accent" />
            <h2 className="font-display text-base">Import a game</h2>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-5">
          {/* From URL */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <Globe size={12} className="text-ink-muted" />
              <span className="label">From URL</span>
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="lichess.org/… or chess.com/game/…"
                className="input flex-1"
                spellCheck={false}
              />
              <button
                className="btn-primary"
                onClick={submitUrl}
                disabled={urlBusy || !url.trim()}
              >
                {urlBusy ? <Loader2 size={14} className="animate-spin" /> : 'Fetch'}
              </button>
            </div>
            {detectedProvider && (
              <p className="text-[10px] text-ink-faint">
                Detected: {detectedProvider === 'lichess' ? 'Lichess' : 'Chess.com'}
              </p>
            )}
            {urlError && <ErrorRow message={urlError} />}
          </section>

          <div className="divider" />

          {/* Paste PGN */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <ClipboardPaste size={12} className="text-ink-muted" />
              <span className="label">Paste PGN</span>
            </div>
            <textarea
              value={pgn}
              onChange={(e) => setPgn(e.target.value)}
              placeholder={`[Event "?"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 …`}
              className="input min-h-[120px] font-mono text-xs leading-relaxed resize-y"
              spellCheck={false}
            />
            {pgnError && <ErrorRow message={pgnError} />}
            <div className="flex gap-2">
              <button className="btn-primary flex-1" onClick={submitPgn}>Load PGN</button>
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
                  if (f) void submitFile(f);
                  e.target.value = '';
                }}
              />
            </div>
          </section>

          <div className="divider" />

          {/* Paste FEN */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <span className="label">Paste FEN</span>
            </div>
            <input
              value={fen}
              onChange={(e) => setFen(e.target.value)}
              placeholder="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
              className="input font-mono text-xs"
              spellCheck={false}
            />
            {fenError && <ErrorRow message={fenError} />}
            <button className="btn-primary" onClick={submitFen}>Load FEN</button>
          </section>

          <div className="divider" />

          {/* Start fresh */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5">
              <PlusSquare size={12} className="text-ink-muted" />
              <span className="label">Start fresh</span>
            </div>
            <p className="text-xs text-ink-muted">
              Load the standard starting position and start tinkering — moves, branches, engine help.
            </p>
            <button className="btn" onClick={submitEmpty}>
              <PlusSquare size={14} /> New empty board
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function ErrorRow({ message }: { message: string }) {
  return (
    <p className="text-xs text-bad flex items-start gap-1.5">
      <AlertCircle size={11} className="shrink-0 mt-0.5" />
      {message}
    </p>
  );
}
