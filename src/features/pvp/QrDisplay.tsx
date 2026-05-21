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
 */
export function QrDisplay({ value, size = 280, textFallback = true }: Props) {
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
        margin: 1,
        // White-on-black to match the app's dark theme. The QR is still
        // light-modules-on-dark which works for all modern scanners.
        color: { dark: '#f7f4ed', light: '#1a1a1f' },
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
