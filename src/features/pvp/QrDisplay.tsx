import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check } from 'lucide-react';

interface Props {
  /** The text payload to encode. Long blobs are fine — the renderer chooses a
   *  QR version big enough automatically, at the cost of denser modules. */
  value: string;
  /** Pixel size of the rendered canvas (square). */
  size?: number;
  /** Show a "Show as text" disclosure so desktop-to-desktop users can paste
   *  instead of pointing a webcam at another screen. */
  textFallback?: boolean;
}

/**
 * Renders an arbitrary string as a QR code, with an optional copy-as-text
 * fallback for cases where a camera scan isn't practical. Uses error
 * correction level 'L' so the largest possible payload still fits — SDP
 * blobs run ~600–1200 chars even after compression.
 *
 * Size matters for scannability. Our SDP payloads land at QR version ~21
 * (103 modules) once LZ-compressed. At the original 280 px display that's
 * only 2.7 px per module — phone cameras can't reliably resolve it from
 * arm's length. Default bumped to 420 px (≈ 4 px/module) which scans
 * cleanly on every device I've tried, and the quiet-zone margin is
 * widened from 1 to 4 to match the QR spec (some scanners refuse below 2).
 */
export function QrDisplay({ value, size = 420, textFallback = true }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showText, setShowText] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    setError(null);
    QRCode.toCanvas(
      canvasRef.current,
      value,
      {
        errorCorrectionLevel: 'L',
        width: size,
        // 4-module quiet zone per QR spec. Some scanners (notably stock
        // iOS Camera) silently refuse to detect QRs with a narrower
        // border, even when the modules themselves are crisp.
        margin: 4,
        // Standard QR polarity: dark modules on light background. The
        // earlier "light modules on dark" matched the app's dark theme
        // but is non-standard — jsQR with `dontInvert` (the fast path
        // we want on phone cameras) can't detect inverted QRs at all,
        // and many third-party scanners (iOS Camera, Google Lens) also
        // assume the standard polarity. The card around the canvas is
        // already dark themed so the white QR sits inside a styled
        // frame; it reads as intentional rather than off-brand.
        color: { dark: '#1a1a1f', light: '#ffffff' },
      },
      (err) => {
        if (err) setError(err.message);
      },
    );
  }, [value, size]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be blocked; just leave the text visible for manual selection.
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className="rounded-xl bg-bg-raised border border-edge p-3 shadow-glass"
        style={{ width: size + 24, height: size + 24 }}
      >
        {error ? (
          <div className="h-full w-full flex items-center justify-center text-bad text-xs text-center px-2">
            QR encode failed: {error}
          </div>
        ) : (
          <canvas ref={canvasRef} style={{ width: size, height: size }} />
        )}
      </div>
      {textFallback && (
        <div className="w-full">
          <button
            className="btn-ghost text-xs w-full"
            onClick={() => setShowText((v) => !v)}
          >
            {showText ? 'Hide text' : 'Show as text instead'}
          </button>
          {showText && (
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                readOnly
                value={value}
                className="input font-mono text-[10px] leading-relaxed h-24 resize-none"
                onFocus={(e) => e.target.select()}
              />
              <button className="btn text-xs" onClick={copy}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
