import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Upload, ImagePlus, Loader2, Wand2, AlertTriangle, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import { useSetupStore } from '@/core/store/setupStore';
import { detectBoardQuad } from './detect';
import { classifyBoard, gridToFenPiecePart, preloadTemplates } from './classify';
import type { BoardQuad, ClassificationResult, Point } from './types';

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * "Import from image" modal. The full pipeline:
 *
 *   1. User drops/picks an image. We auto-detect the board's axis-aligned
 *      bounding quad and run the per-square classifier in the background.
 *   2. The image preview overlays draggable corner handles. Moving any
 *      corner re-runs classification — the user can dial in the crop
 *      until the detected glyphs line up with what they see.
 *   3. "Apply to board" writes the assembled FEN into setupStore and the
 *      user reviews / corrects on the main /setup board.
 *
 * Honest about failure modes: a banner surfaces the auto-detect confidence,
 * and per-square low-confidence cells are flagged so the user knows where
 * to look. We never claim the position is correct — the workflow always
 * ends with the user reviewing on the actual editor before hitting Analyze.
 */
export function ImportFromImageModal({ open, onClose }: Props) {
  // Imported lazily via useSetupStore.getState() inside the apply handler
  // — we don't need a reactive subscription to it.
  void useSetupStore;

  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [quad, setQuad] = useState<BoardQuad | null>(null);
  const [detectConfidence, setDetectConfidence] = useState<number>(0);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState<keyof BoardQuad | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset everything on close so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      setImageEl(null);
      setQuad(null);
      setDetectConfidence(0);
      setClassification(null);
      setError(null);
      setBusy(false);
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    } else {
      // Kick off template rendering while the user picks their image so
      // the first classify() call doesn't pay the SVG-decode tax.
      preloadTemplates().catch(() => { /* not fatal */ });
    }
  }, [open]);

  // Tracking the live blob URL so we can revoke it when the modal closes or
  // a new image replaces it. Revoking on img.onload (the cleanest moment for
  // GC) would break the <img src> render later — the JSX consumer needs the
  // URL to still resolve.
  const blobUrlRef = useRef<string | null>(null);

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('That doesn\'t look like an image.');
      return;
    }
    setError(null);
    // Free any previous blob URL — replacing the image otherwise leaks.
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const url = URL.createObjectURL(file);
    blobUrlRef.current = url;
    const img = new Image();
    img.onload = () => {
      setImageEl(img);
      // Auto-detect & classify on load.
      runDetectAndClassify(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      blobUrlRef.current = null;
      setError('Failed to decode the image.');
    };
    img.src = url;
  };

  const runDetectAndClassify = async (img: HTMLImageElement, fixedQuad?: BoardQuad) => {
    setBusy(true);
    setError(null);
    try {
      const det = fixedQuad ? null : detectBoardQuad(img);
      const q = fixedQuad ?? det!.quad;
      setQuad(q);
      if (det) setDetectConfidence(det.confidence);
      const result = await classifyBoard(img, q);
      setClassification(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Reclassify whenever the quad is dragged into a new position. We
  // debounce slightly so a drag doesn't kick off a classify on every frame.
  useEffect(() => {
    if (!imageEl || !quad) return;
    const handle = window.setTimeout(() => {
      classifyBoard(imageEl, quad)
        .then(setClassification)
        .catch((e) => setError((e as Error).message));
    }, 80);
    return () => window.clearTimeout(handle);
    // Run on quad change only — re-running on imageEl is handled by the
    // initial load path.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quad]);

  const applyDetection = () => {
    if (!classification) return;
    const piecePart = gridToFenPiecePart(classification.grid);
    const fen = `${piecePart} w - - 0 1`;
    useSetupStore.getState().loadFen(fen);
    onClose();
  };

  // ----- Corner-drag handling -----
  // Translate mouse coordinates from overlay client space into source-image
  // pixel space (the same coordinate system the BoardQuad lives in).
  const overlayToImage = (clientX: number, clientY: number): Point | null => {
    if (!overlayRef.current || !imageEl) return null;
    const rect = overlayRef.current.getBoundingClientRect();
    const scaleX = imageEl.naturalWidth / rect.width;
    const scaleY = imageEl.naturalHeight / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  // Drag handlers attached on a per-corner basis. Pointer events give us
  // pointer-up notifications outside the modal too, which is what we want
  // — a user can drag past the modal edge without losing the drag.
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const p = overlayToImage(e.clientX, e.clientY);
      if (!p || !quad) return;
      // Clamp into image bounds so a corner can't be dragged off-canvas
      // (the classifier would clip the source extraction).
      const clampedX = Math.max(0, Math.min(imageEl!.naturalWidth, p.x));
      const clampedY = Math.max(0, Math.min(imageEl!.naturalHeight, p.y));
      setQuad({ ...quad, [dragging]: { x: clampedX, y: clampedY } });
    };
    const onUp = () => setDragging(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragging, quad, imageEl]);

  // Render the per-square detected glyph as a Unicode chess character. The
  // overlay's font matches the board's grid, so a glance is enough for the
  // user to see what was detected without zooming.
  const fenToGlyph: Record<string, string> = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
  };

  // Render into document.body so the modal's fixed-positioning escapes any
  // ancestor with `backdrop-filter`/`transform`/`filter` (the .panel class
  // creates such a containing block, which would otherwise constrain
  // `inset-0` to the SetupPanel's column instead of the viewport).
  return createPortal(
    <div
      className={clsx(
        'fixed inset-0 z-50 transition-opacity flex items-center justify-center p-3 sm:p-6',
        open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none',
      )}
      aria-hidden={!open}
    >
      <button
        className="absolute inset-0 bg-black/55 backdrop-blur-sm cursor-default"
        aria-label="Close image import"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <div
        className={clsx(
          'relative panel w-full sm:max-w-2xl max-h-full flex flex-col',
          'transition-transform duration-200',
          open ? 'scale-100' : 'scale-95',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Import from image"
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-edge shrink-0">
          <div className="flex items-center gap-2">
            <ImagePlus size={16} className="text-accent" />
            <h2 className="font-display text-base">Import from image</h2>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close">
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col gap-4">
          {!imageEl && (
            <DropZone
              onPick={() => fileRef.current?.click()}
              onDrop={handleFile}
            />
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = '';
            }}
          />

          {imageEl && quad && (
            <div className="flex flex-col gap-3">
              <ImagePreview
                imageEl={imageEl}
                quad={quad}
                classification={classification}
                fenToGlyph={fenToGlyph}
                onCornerPointerDown={(corner) => setDragging(corner)}
                overlayRef={overlayRef}
              />
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="text-ink-muted">
                  Drag the 4 corners to line up with the board. The grid below shows what was detected.
                </span>
                <button
                  className="text-ink-muted hover:text-ink underline underline-offset-2"
                  onClick={() => {
                    setImageEl(null);
                    setQuad(null);
                    setClassification(null);
                  }}
                >
                  pick another image
                </button>
              </div>

              {detectConfidence > 0 && detectConfidence < 0.5 && (
                <div className="panel-tight border-warning/40 bg-warning/5 p-2.5 text-[11px] text-ink-muted flex items-start gap-2">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  <span>
                    Auto-detect wasn&apos;t confident. Drag the corners to match the board edges before applying.
                  </span>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="panel-tight border-bad/40 bg-bad/5 p-2.5 text-xs text-bad flex items-start gap-2">
              <AlertTriangle size={12} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 px-4 py-3 border-t border-edge shrink-0">
          <button className="btn h-9 px-3 text-xs" onClick={onClose}>Cancel</button>
          <button
            className="btn-primary h-9 px-3 justify-center"
            onClick={applyDetection}
            disabled={!classification || busy}
            title={classification ? 'Write detected pieces into the editor' : 'Pick an image first'}
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
            Apply to board
            <ArrowRight size={12} />
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}

function DropZone({ onPick, onDrop }: { onPick: () => void; onDrop: (file: File) => void }) {
  const [hot, setHot] = useState(false);
  return (
    <button
      type="button"
      onClick={onPick}
      onDragOver={(e) => { e.preventDefault(); setHot(true); }}
      onDragLeave={() => setHot(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHot(false);
        const file = e.dataTransfer.files[0];
        if (file) onDrop(file);
      }}
      className={clsx(
        'panel-tight w-full py-12 px-4 flex flex-col items-center gap-2 text-sm transition-colors',
        hot ? 'border-accent/60 bg-accent/5 text-ink' : 'text-ink-muted hover:text-ink',
      )}
    >
      <Upload size={24} className="text-accent" />
      <span className="font-medium text-ink">Drop an image, or click to choose</span>
      <span className="text-[11px]">Lichess / Chess.com screenshots work best. Photos with perspective are dicier — drag the corners to fix.</span>
    </button>
  );
}

function ImagePreview({
  imageEl,
  quad,
  classification,
  fenToGlyph,
  onCornerPointerDown,
  overlayRef,
}: {
  imageEl: HTMLImageElement;
  quad: BoardQuad;
  classification: ClassificationResult | null;
  fenToGlyph: Record<string, string>;
  onCornerPointerDown: (corner: keyof BoardQuad) => void;
  overlayRef: React.RefObject<HTMLDivElement | null>;
}) {
  // Compute corner positions as percentages of the displayed image so the
  // overlay layout-floats correctly regardless of how the image scales to
  // fit the modal width.
  const W = imageEl.naturalWidth;
  const H = imageEl.naturalHeight;
  const pct = (p: Point) => ({ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%` });
  const corners: Array<{ key: keyof BoardQuad; p: Point }> = [
    { key: 'tl', p: quad.tl },
    { key: 'tr', p: quad.tr },
    { key: 'br', p: quad.br },
    { key: 'bl', p: quad.bl },
  ];
  // For the detection grid overlay, use the quad's axis-aligned bounding
  // box. (v1 only generates axis-aligned quads.)
  const left = quad.tl.x;
  const top = quad.tl.y;
  const width = quad.tr.x - quad.tl.x;
  const height = quad.bl.y - quad.tl.y;

  return (
    <div
      ref={overlayRef}
      className="relative w-full overflow-hidden rounded-lg border border-edge bg-bg"
      style={{ aspectRatio: `${W} / ${H}` }}
    >
      <img src={imageEl.src} alt="" className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none" draggable={false} />
      {/* Translucent rectangle marking the detected board */}
      <div
        className="absolute border-2 border-accent/80 pointer-events-none"
        style={{
          left: `${(left / W) * 100}%`,
          top: `${(top / H) * 100}%`,
          width: `${(width / W) * 100}%`,
          height: `${(height / H) * 100}%`,
        }}
      />
      {/* 8×8 grid overlaid with detected glyphs */}
      {classification && (
        <div
          className="absolute grid pointer-events-none"
          style={{
            left: `${(left / W) * 100}%`,
            top: `${(top / H) * 100}%`,
            width: `${(width / W) * 100}%`,
            height: `${(height / H) * 100}%`,
            gridTemplateColumns: 'repeat(8, minmax(0, 1fr))',
            gridTemplateRows: 'repeat(8, minmax(0, 1fr))',
          }}
        >
          {classification.grid.flatMap((row, r) =>
            row.map((piece, f) => {
              const conf = classification.confidence[r][f];
              return (
                <div
                  key={`${r}-${f}`}
                  className={clsx(
                    'flex items-center justify-center text-[18px] sm:text-[22px] leading-none select-none',
                    piece && conf < 0.4 ? 'text-bad/80' : 'text-accent/90',
                  )}
                  style={{ textShadow: '0 1px 2px rgba(0,0,0,.8), 0 0 6px rgba(0,0,0,.6)' }}
                >
                  {piece ? fenToGlyph[piece] : ''}
                </div>
              );
            }),
          )}
        </div>
      )}
      {/* Corner-drag handles */}
      {corners.map(({ key, p }) => (
        <button
          key={key}
          type="button"
          aria-label={`Corner ${key}`}
          onPointerDown={(e) => {
            e.preventDefault();
            (e.target as Element).setPointerCapture?.(e.pointerId);
            onCornerPointerDown(key);
          }}
          className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-accent ring-2 ring-bg shadow cursor-grab active:cursor-grabbing"
          style={pct(p)}
        />
      ))}
    </div>
  );
}
