import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Camera, CameraOff, ClipboardPaste } from 'lucide-react';

interface Props {
  /** Called with the decoded string. Caller should validate / decode it. */
  onResult: (text: string) => void;
  /** Status copy under the viewfinder, e.g. "Scan your friend's QR". */
  hint?: string;
}

/**
 * Camera-based QR scanner with a manual paste fallback for desktop-to-desktop
 * pairs (or anyone without a working camera). Uses jsQR — the BarcodeDetector
 * API would be nicer but its support is uneven across browsers and we want a
 * single code path so the host and joiner scan paths behave identically.
 *
 * On first mount we request the rear camera (`facingMode: 'environment'`) so
 * a phone user holds their device naturally; on desktops the front camera is
 * picked up automatically as a fallback.
 */
export function QrScanner({ onResult, hint }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'scanning' | 'denied' | 'unsupported'>('idle');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported');
        return;
      }
      setStatus('starting');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        // iOS Safari needs playsinline + muted before play() resolves.
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        await video.play();
        canvasRef.current = document.createElement('canvas');
        setStatus('scanning');
        tick();
      } catch {
        if (!cancelled) setStatus('denied');
      }
    }
    start();
    return () => {
      cancelled = true;
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function tick() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (w > 0 && h > 0) {
        // Downscale to ~480 px on the long edge — jsQR is plenty accurate at
        // that resolution and it cuts per-frame CPU significantly so the
        // scanner stays responsive on phones.
        const scale = Math.min(1, 480 / Math.max(w, h));
        const sw = Math.round(w * scale);
        const sh = Math.round(h * scale);
        if (canvas.width !== sw) canvas.width = sw;
        if (canvas.height !== sh) canvas.height = sh;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, sw, sh);
          const data = ctx.getImageData(0, 0, sw, sh);
          const code = jsQR(data.data, sw, sh, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            stopStream();
            onResult(code.data);
            return;
          }
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function stopStream() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  const submitPaste = () => {
    const v = pasteValue.trim();
    if (!v) return;
    stopStream();
    onResult(v);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-square w-full max-w-[280px] mx-auto rounded-xl overflow-hidden bg-bg-raised border border-edge"
      >
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        {status !== 'scanning' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-muted text-xs text-center px-4 bg-bg/60">
            {status === 'denied' && (
              <>
                <CameraOff size={20} />
                <span>Camera access denied.</span>
                <span className="text-ink-faint">Use paste fallback below.</span>
              </>
            )}
            {status === 'unsupported' && (
              <>
                <CameraOff size={20} />
                <span>Camera not supported here.</span>
              </>
            )}
            {(status === 'idle' || status === 'starting') && (
              <>
                <Camera size={20} />
                <span>Requesting camera…</span>
              </>
            )}
          </div>
        )}
        {status === 'scanning' && (
          // A soft viewfinder frame so users know where to aim.
          <div className="absolute inset-6 border-2 border-accent/70 rounded-lg pointer-events-none" />
        )}
      </div>
      {hint && <p className="text-center text-xs text-ink-muted">{hint}</p>}

      <button
        className="btn-ghost text-xs"
        onClick={() => setPasteOpen((v) => !v)}
      >
        <ClipboardPaste size={12} />
        {pasteOpen ? 'Hide paste fallback' : 'Paste instead'}
      </button>
      {pasteOpen && (
        <div className="flex flex-col gap-2">
          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder="Paste the text from your friend's screen"
            className="input font-mono text-[10px] leading-relaxed h-20 resize-none"
          />
          <button className="btn-primary text-xs" onClick={submitPaste} disabled={!pasteValue.trim()}>
            Use this text
          </button>
        </div>
      )}
    </div>
  );
}
