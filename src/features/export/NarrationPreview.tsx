import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { findOpening } from '@/features/openings/catalog';
import { findGame } from '@/features/games/catalog';
import { generateNarration } from './narration';
import { synthesize, getKokoro, isKokoroLoaded, KOKORO_PICKER } from './tts/kokoroTts';
import type { PickerVoice } from './tts/kokoroTts';
import { Mic, Play, Square as StopIcon, ChevronDown, Sparkles, Loader2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * Live preview of the generated narration. Two voice tiers:
 *
 *   - **OS voices** (browser's SpeechSynthesis): instant, 0 KB bundle,
 *     robotic but recognizable. Default. Picker enumerates whatever
 *     voices the user's OS has installed.
 *
 *   - **Neural voices** (kokoro-js): high quality, downloads-on-demand
 *     (~20 MB at q8 quantization, then cached forever). 7 curated
 *     English voices shown in the picker. Picking one for the first
 *     time triggers a model fetch with a progress bar.
 *
 * The neural-voice tier is the audio path that'll feed Phase 1d's
 * ffmpeg muxing — SpeechSynthesis output can't be captured. For the
 * preview surface they're interchangeable (both play through the
 * speakers), which lets the user A/B them before committing to a
 * voice for the actual exported video.
 *
 * As playback advances we nudge gameStore.ply so the board visually
 * marches through the same positions the narration is describing.
 */
export function NarrationPreview() {
  const game = useGameStore((s) => s.game);
  const goTo = useGameStore((s) => s.goTo);

  const opening = game.meta.openingId ? findOpening(game.meta.openingId) : undefined;
  const famous = game.meta.gameId ? findGame(game.meta.gameId) : undefined;

  const script = useMemo(
    () => generateNarration({ game, opening, famousGame: famous }),
    [game, opening, famous],
  );

  // ----- OS-voice picker (SpeechSynthesis) -----
  const [osVoices, setOsVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => {
      const list = window.speechSynthesis?.getVoices() ?? [];
      const sorted = [...list].sort((a, b) => {
        const aEn = a.lang?.startsWith('en') ? 0 : 1;
        const bEn = b.lang?.startsWith('en') ? 0 : 1;
        if (aEn !== bEn) return aEn - bEn;
        return a.name.localeCompare(b.name);
      });
      setOsVoices(sorted);
    };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
  }, []);

  // ----- Unified picker: kind + id -----
  type VoiceKind = 'os' | 'neural';
  const [voiceKind, setVoiceKind] = useState<VoiceKind>('os');
  const [voiceId, setVoiceId] = useState<string>(''); // OS voiceURI or kokoro id
  useEffect(() => {
    if (voiceKind === 'os' && osVoices.length && !voiceId) {
      setVoiceId(osVoices[0].voiceURI);
    }
    if (voiceKind === 'neural' && !voiceId) {
      setVoiceId(KOKORO_PICKER[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceKind, osVoices]);

  // ----- Neural-voice load state -----
  const [neuralLoading, setNeuralLoading] = useState(false);
  const [neuralProgress, setNeuralProgress] = useState(0);
  const [neuralError, setNeuralError] = useState<string | null>(null);
  const [neuralReady, setNeuralReady] = useState(isKokoroLoaded());

  const ensureNeuralLoaded = async () => {
    if (isKokoroLoaded()) { setNeuralReady(true); return true; }
    setNeuralLoading(true);
    setNeuralError(null);
    try {
      await getKokoro({ onProgress: setNeuralProgress });
      setNeuralReady(true);
      return true;
    } catch (e) {
      setNeuralError((e as Error).message || 'Failed to load voice');
      return false;
    } finally {
      setNeuralLoading(false);
    }
  };

  // ----- Playback -----
  const [playing, setPlaying] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState<number>(-1);
  const runIdRef = useRef(0);
  // A persistent AudioContext for kokoro playback. Created lazily on
  // first neural play so we don't spin one up for users who never opt in.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const stop = () => {
    runIdRef.current++;
    window.speechSynthesis?.cancel();
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch { /* already stopped */ }
      currentSourceRef.current = null;
    }
    setPlaying(false);
    setCurrentLineIdx(-1);
  };

  const play = async () => {
    if (voiceKind === 'neural') {
      const ok = await ensureNeuralLoaded();
      if (!ok) return;
      if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    } else {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
    }
    const runId = ++runIdRef.current;
    setPlaying(true);

    const lines: Array<{ text: string; ply?: number }> = [
      { text: script.intro },
      ...script.perMove.map((text, i) => ({ text, ply: i + 1 })),
      { text: script.outro },
    ];

    const osVoice = voiceKind === 'os' ? osVoices.find((v) => v.voiceURI === voiceId) : undefined;
    const kokoroVoiceId = voiceKind === 'neural' ? voiceId : null;

    for (let i = 0; i < lines.length; i++) {
      if (runIdRef.current !== runId) return;
      const line = lines[i];
      setCurrentLineIdx(i);
      if (line.ply !== undefined) goTo(line.ply);

      if (kokoroVoiceId) {
        await speakWithKokoro(line.text, kokoroVoiceId, audioCtxRef.current!, currentSourceRef);
      } else {
        await speakWithOs(line.text, osVoice);
      }

      if (runIdRef.current !== runId) return;
      await wait(180);
    }
    setPlaying(false);
    setCurrentLineIdx(-1);
  };

  useEffect(() => () => stop(), []);

  if (!game.moves.length) return null;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Mic size={14} className="text-accent" />
        <h3 className="font-display text-sm">Narration preview</h3>
      </div>

      {/* Voice-kind tabs */}
      <div className="grid grid-cols-2 gap-1 panel-tight p-1">
        <KindButton
          active={voiceKind === 'os'}
          onClick={() => { setVoiceKind('os'); setVoiceId(''); }}
          label="System voice"
        />
        <KindButton
          active={voiceKind === 'neural'}
          onClick={() => { setVoiceKind('neural'); setVoiceId(''); }}
          label="Neural voice"
          badge={neuralReady ? undefined : '~20 MB'}
          icon={<Sparkles size={11} />}
        />
      </div>

      {/* Voice picker — content depends on kind */}
      {voiceKind === 'os' && (
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-ink-muted">Voice</span>
          <div className="relative">
            <select
              className="bg-bg border border-edge rounded px-2 py-1 pr-6 text-xs max-w-[200px] truncate appearance-none"
              value={voiceId}
              onChange={(e) => setVoiceId(e.target.value)}
            >
              {osVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          </div>
        </label>
      )}
      {voiceKind === 'neural' && (
        <>
          <label className="flex items-center justify-between gap-2 text-xs">
            <span className="text-ink-muted">Voice</span>
            <div className="relative">
              <select
                className="bg-bg border border-edge rounded px-2 py-1 pr-6 text-xs max-w-[220px] truncate appearance-none"
                value={voiceId}
                onChange={(e) => setVoiceId(e.target.value)}
              >
                {KOKORO_PICKER.map((v: PickerVoice) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </select>
              <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            </div>
          </label>
          {!neuralReady && !neuralLoading && (
            <p className="text-[10px] text-ink-faint leading-relaxed">
              First use downloads ~20 MB of voice weights from Hugging Face. Cached for offline reuse after.
            </p>
          )}
          {neuralLoading && (
            <div className="panel-tight p-2 text-[11px] text-ink-muted flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-accent" />
              <div className="flex-1">
                Downloading voice weights… {Math.round(neuralProgress * 100)}%
                <div className="mt-1 h-1 rounded bg-bg overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${neuralProgress * 100}%` }} />
                </div>
              </div>
            </div>
          )}
          {neuralError && (
            <p className="text-[11px] text-bad">{neuralError}</p>
          )}
        </>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <button
          className="btn h-8 text-xs justify-center gap-1.5"
          onClick={play}
          disabled={playing || (voiceKind === 'os' && osVoices.length === 0) || neuralLoading}
        >
          <Play size={12} /> Preview narration
        </button>
        <button
          className="btn h-8 text-xs justify-center gap-1.5"
          onClick={stop}
          disabled={!playing}
        >
          <StopIcon size={12} /> Stop
        </button>
      </div>

      <details className="panel-tight p-2.5">
        <summary className="text-[11px] text-ink-muted cursor-pointer select-none">Script</summary>
        <div className="mt-2 flex flex-col gap-1 text-[11px] max-h-48 overflow-y-auto">
          <ScriptLine text={script.intro} active={currentLineIdx === 0} />
          {script.perMove.map((line, i) => (
            <ScriptLine key={i} text={line} active={currentLineIdx === i + 1} />
          ))}
          <ScriptLine text={script.outro} active={currentLineIdx === script.perMove.length + 1} />
        </div>
      </details>
    </div>
  );
}

function KindButton({
  active, onClick, label, badge, icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-md px-2 py-1.5 text-[11px] font-medium flex items-center justify-center gap-1.5 transition-colors',
        active ? 'bg-accent text-bg' : 'text-ink-muted hover:text-ink hover:bg-bg-subtle',
      )}
    >
      {icon} {label}
      {badge && (
        <span className={clsx(
          'text-[9px] uppercase tracking-wider px-1 py-0.5 rounded',
          active ? 'bg-bg/30' : 'bg-bg-subtle text-ink-faint',
        )}>
          {badge}
        </span>
      )}
    </button>
  );
}

function ScriptLine({ text, active }: { text: string; active: boolean }) {
  return (
    <p className={clsx(
      'leading-relaxed transition-colors',
      active ? 'text-accent' : 'text-ink-muted',
    )}>
      {text}
    </p>
  );
}

function speakWithOs(text: string, voice?: SpeechSynthesisVoice): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

async function speakWithKokoro(
  text: string,
  voiceId: string,
  ctx: AudioContext,
  sourceRef: React.MutableRefObject<AudioBufferSourceNode | null>,
): Promise<void> {
  // Synthesize the audio buffer. This blocks the worker thread the model
  // runs on, not the UI thread — but the await is still long-ish on
  // sentence-length inputs (a few hundred ms to a few seconds).
  const { samples, sampleRate } = await synthesize(text, { voice: voiceId });
  // Build a Web Audio buffer matching kokoro's output format. Copy through
  // a fresh Float32Array — kokoro returns Float32Array<ArrayBufferLike>
  // which TS 5.7+'s narrower lib.dom rejects for copyToChannel.
  const channel = new Float32Array(samples.length);
  channel.set(samples);
  const buffer = ctx.createBuffer(1, channel.length, sampleRate);
  buffer.copyToChannel(channel, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  sourceRef.current = src;
  return new Promise((resolve) => {
    src.onended = () => {
      if (sourceRef.current === src) sourceRef.current = null;
      resolve();
    };
    src.start();
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
