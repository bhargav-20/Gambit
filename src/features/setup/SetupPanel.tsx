import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSetupStore } from '@/core/store/setupStore';
import { useGameStore } from '@/core/store/gameStore';
import { loadEmpty } from '@/core/chess/pgn';
import { Wand2, Trash2, RotateCcw, Image as ImageIcon, Copy, AlertTriangle, Check, ArrowRight, FlipHorizontal2, Undo2 } from 'lucide-react';
import clsx from 'clsx';
import { checkValidity } from './validity';
import { ImportFromImageModal } from './imageImport/ImportFromImageModal';

/**
 * Right-panel content for the /setup route. Side-to-move toggle, castling
 * checkboxes, en-passant + clock fields, FEN strip, validity badge, then
 * the primary CTA: "Analyze this position →" which loads the FEN into the
 * main gameStore and navigates to /analyze.
 *
 * The "Import from image" button is a deliberate stub for now — when the
 * image-to-position add-on lands it'll open a modal whose pipeline ends in
 * a setupStore.loadFen(detectedFen) call. Shipping the stub now keeps the
 * visual contract stable so the add-on doesn't reshuffle the UI later.
 */
export function SetupPanel() {
  const navigate = useNavigate();
  const squares = useSetupStore((s) => s.squares);
  const sideToMove = useSetupStore((s) => s.sideToMove);
  const castling = useSetupStore((s) => s.castling);
  const enPassant = useSetupStore((s) => s.enPassant);
  const halfmove = useSetupStore((s) => s.halfmove);
  const fullmove = useSetupStore((s) => s.fullmove);

  const flipSide = useSetupStore((s) => s.flipSide);
  const setCastlingRight = useSetupStore((s) => s.setCastlingRight);
  const setEnPassant = useSetupStore((s) => s.setEnPassant);
  const setHalfmove = useSetupStore((s) => s.setHalfmove);
  const setFullmove = useSetupStore((s) => s.setFullmove);
  const clearBoard = useSetupStore((s) => s.clearBoard);
  const loadStartingPosition = useSetupStore((s) => s.loadStartingPosition);
  const loadFen = useSetupStore((s) => s.loadFen);
  const undo = useSetupStore((s) => s.undo);
  // Subscribe to history.length so the Undo button enables/disables reactively.
  const historyDepth = useSetupStore((s) => s.history.length);

  const flipOrientation = useGameStore((s) => s.flip);
  const loadGame = useGameStore((s) => s.loadGame);
  const analyzeGame = useGameStore((s) => s.analyzeGame);

  const fen = useMemo(
    () => useSetupStore.getState().toFen(),
    [squares, sideToMove, castling, enPassant, halfmove, fullmove],
  );

  const validity = useMemo(
    () => checkValidity({ squares, sideToMove, castling, enPassant, fen }),
    [squares, sideToMove, castling, enPassant, fen],
  );

  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [imageImportOpen, setImageImportOpen] = useState(false);

  // Cmd/Ctrl+Z while this panel is mounted pops the most recent change. We
  // bind here (not in a global hook) so the binding is scoped to /setup and
  // doesn't fight other surfaces' undo expectations.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z' || e.shiftKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      e.preventDefault();
      useSetupStore.getState().undo();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const copyFen = async () => {
    try {
      await navigator.clipboard.writeText(fen);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // Clipboard might be unavailable in insecure contexts — fail quietly,
      // the FEN strip is selectable as a fallback.
    }
  };

  const applyPaste = () => {
    const r = loadFen(pasteValue.trim());
    if (!r.ok) { setPasteError(r.error); return; }
    setPasteError(null);
    setPasteOpen(false);
    setPasteValue('');
  };

  const analyze = () => {
    if (!validity.ok) return;
    loadGame(loadEmpty(fen, { title: 'Custom position', source: 'editor' }));
    // Flip into analyze mode explicitly. AnalyzeRoute's mount effect that
    // would normally do this doesn't reliably fire on soft hash navigation,
    // and the engine gates analysis on mode === 'analyze'. Doing it here at
    // the explicit user-action boundary makes the engine pick up the new
    // position the moment the route changes.
    analyzeGame();
    navigate('/analyze');
  };

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-2">
        <Wand2 size={16} className="text-accent" />
        <h2 className="font-display text-lg">Set up position</h2>
      </div>

      {/* Side-to-move */}
      <div>
        <div className="label mb-1.5">Side to move</div>
        <div className="grid grid-cols-2 gap-1 panel-tight p-1">
          <SideButton active={sideToMove === 'w'} label="White" onClick={() => sideToMove === 'b' && flipSide()} />
          <SideButton active={sideToMove === 'b'} label="Black" onClick={() => sideToMove === 'w' && flipSide()} />
        </div>
      </div>

      {/* Castling */}
      <div>
        <div className="label mb-1.5">Castling rights</div>
        <div className="grid grid-cols-2 gap-1.5">
          <CastleBox label="White O-O" on={castling.K} onClick={() => setCastlingRight('K', !castling.K)} />
          <CastleBox label="White O-O-O" on={castling.Q} onClick={() => setCastlingRight('Q', !castling.Q)} />
          <CastleBox label="Black O-O" on={castling.k} onClick={() => setCastlingRight('k', !castling.k)} />
          <CastleBox label="Black O-O-O" on={castling.q} onClick={() => setCastlingRight('q', !castling.q)} />
        </div>
      </div>

      {/* EP + clock — collapsed defaults; rarely edited */}
      <details className="panel-tight p-2.5">
        <summary className="text-xs text-ink-muted cursor-pointer select-none">Advanced (en-passant, clocks)</summary>
        <div className="mt-2.5 flex flex-col gap-2 text-xs">
          <label className="flex items-center justify-between gap-2">
            <span className="text-ink-muted">En-passant target</span>
            <input
              type="text"
              value={enPassant ?? ''}
              placeholder="—"
              onChange={(e) => {
                const v = e.target.value.trim().toLowerCase();
                setEnPassant(v === '' || v === '-' ? null : (v as never));
              }}
              className="bg-bg border border-edge rounded px-1.5 py-0.5 w-16 text-center font-mono"
              maxLength={2}
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-ink-muted">Halfmove clock</span>
            <input
              type="number"
              min={0}
              value={halfmove}
              onChange={(e) => setHalfmove(Number(e.target.value))}
              className="bg-bg border border-edge rounded px-1.5 py-0.5 w-16 text-center font-mono"
            />
          </label>
          <label className="flex items-center justify-between gap-2">
            <span className="text-ink-muted">Move number</span>
            <input
              type="number"
              min={1}
              value={fullmove}
              onChange={(e) => setFullmove(Number(e.target.value))}
              className="bg-bg border border-edge rounded px-1.5 py-0.5 w-16 text-center font-mono"
            />
          </label>
        </div>
      </details>

      {/* Board actions */}
      <div className="grid grid-cols-4 gap-1.5">
        <button
          className="btn h-8 text-xs justify-center gap-1.5"
          onClick={undo}
          disabled={historyDepth === 0}
          title="Undo last change (⌘Z / Ctrl+Z)"
        >
          <Undo2 size={12} /> Undo
        </button>
        <button className="btn h-8 text-xs justify-center gap-1.5" onClick={loadStartingPosition} title="Reset to the standard starting position">
          <RotateCcw size={12} /> Start
        </button>
        <button className="btn h-8 text-xs justify-center gap-1.5" onClick={clearBoard} title="Clear all pieces">
          <Trash2 size={12} /> Clear
        </button>
        <button className="btn h-8 text-xs justify-center gap-1.5" onClick={flipOrientation} title="Flip board orientation">
          <FlipHorizontal2 size={12} /> Flip
        </button>
      </div>

      {/* Image import — opens the recognition modal */}
      <button
        className="btn h-8 text-xs justify-center gap-1.5"
        title="Drop a board screenshot, auto-detect the position"
        onClick={() => setImageImportOpen(true)}
      >
        <ImageIcon size={12} /> Import from image
      </button>
      <ImportFromImageModal open={imageImportOpen} onClose={() => setImageImportOpen(false)} />

      {/* FEN strip + paste */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="label">Current FEN</span>
          <div className="flex items-center gap-2">
            <button className="text-[10px] text-ink-muted hover:text-ink underline underline-offset-2" onClick={() => setPasteOpen((v) => !v)}>
              {pasteOpen ? 'cancel' : 'paste FEN'}
            </button>
            <button className="text-[10px] flex items-center gap-1 text-ink-muted hover:text-ink" onClick={copyFen}>
              {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
            </button>
          </div>
        </div>
        <div className="panel-tight p-2 font-mono text-[10px] text-ink-muted break-all leading-relaxed select-all">
          {fen}
        </div>
        {pasteOpen && (
          <div className="flex flex-col gap-1.5">
            <textarea
              className="bg-bg border border-edge rounded px-2 py-1 font-mono text-[10px] min-h-[60px] resize-y"
              placeholder="Paste a FEN string here"
              value={pasteValue}
              onChange={(e) => { setPasteValue(e.target.value); setPasteError(null); }}
            />
            {pasteError && <p className="text-[10px] text-bad">{pasteError}</p>}
            <button className="btn h-7 text-[11px] justify-center" onClick={applyPaste} disabled={!pasteValue.trim()}>
              Apply pasted FEN
            </button>
          </div>
        )}
      </div>

      {/* Validity */}
      {validity.errors.length > 0 && (
        <div className="panel-tight border-bad/40 bg-bad/5 p-2.5 text-xs text-bad flex flex-col gap-1">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle size={12} className="shrink-0" /> Position is not legal
          </div>
          <ul className="list-disc pl-4 space-y-0.5 text-ink leading-relaxed">
            {validity.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
      {validity.warnings.length > 0 && (
        <div className="panel-tight border-warning/40 bg-warning/5 p-2.5 text-[11px] text-ink-muted">
          {validity.warnings.join(' · ')}
        </div>
      )}

      {/* CTA */}
      <button
        className="btn-primary mt-auto justify-center"
        onClick={analyze}
        disabled={!validity.ok}
        title={validity.ok ? 'Open this position in the engine' : 'Fix the errors above to enable'}
      >
        Analyze this position <ArrowRight size={14} />
      </button>
    </div>
  );
}

function SideButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
        active ? 'bg-accent text-bg' : 'text-ink-muted hover:text-ink hover:bg-bg-subtle',
      )}
    >
      {label}
    </button>
  );
}

function CastleBox({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-md border px-2 py-1.5 text-[11px] flex items-center justify-between gap-2 transition-colors',
        on ? 'border-accent/50 bg-accent/10 text-ink' : 'border-edge text-ink-muted hover:border-edge-strong',
      )}
      aria-pressed={on}
    >
      <span>{label}</span>
      <span className={clsx('w-3 h-3 rounded-sm border', on ? 'bg-accent border-accent' : 'border-edge-strong')}>
        {on && <Check size={10} className="text-bg" />}
      </span>
    </button>
  );
}
