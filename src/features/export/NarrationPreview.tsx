import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { useUiStore } from '@/core/store/uiStore';
import { useNarrationStore } from '@/core/store/narrationStore';
import { findOpening } from '@/features/openings/catalog';
import { findGame } from '@/features/games/catalog';
import { generateNarration } from './narration';
import { synthesize, getKokoro, isKokoroLoaded, KOKORO_PICKER } from './tts/kokoroTts';
import type { PickerVoice } from './tts/kokoroTts';
import { AudioMixer } from './audio/AudioMixer';
import { Mic, Play, Square as StopIcon, ChevronDown, Sparkles, Loader2, Music, Upload, X } from 'lucide-react';
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
      // macOS exposes multiple SpeechSynthesisVoice entries that share the
      // same `voiceURI` (e.g. Samantha at multiple sample rates, the
      // "premium" tier alongside the default). Without deduping, the
      // <option key={voiceURI}> renders trip React's "duplicate keys" warning
      // and the picker can only ever select the first one anyway. Keep the
      // first occurrence per URI; the OS already orders them with the
      // preferred voice first.
      const seen = new Set<string>();
      const unique = list.filter((v) => {
        if (seen.has(v.voiceURI)) return false;
        seen.add(v.voiceURI);
        return true;
      });
      const sorted = unique.sort((a, b) => {
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

  // ----- Unified picker (config lives in narrationStore so ExportPanel
  // can also read it when wiring the Render-with-narration flow) -----
  const voiceKind = useNarrationStore((s) => s.voiceKind);
  const setVoiceKind = useNarrationStore((s) => s.setVoiceKind);
  const voiceId = useNarrationStore((s) => s.voiceId);
  const setVoiceId = useNarrationStore((s) => s.setVoiceId);
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

  // ----- Mix controls (Phase 1c) — backed by narrationStore -----
  const voiceVolume = useNarrationStore((s) => s.voiceVolume);
  const setVoiceVolume = useNarrationStore((s) => s.setVoiceVolume);
  const musicVolume = useNarrationStore((s) => s.musicVolume);
  const setMusicVolume = useNarrationStore((s) => s.setMusicVolume);
  const autoDuck = useNarrationStore((s) => s.autoDuck);
  const setAutoDuck = useNarrationStore((s) => s.setAutoDuck);
  const musicBlob = useNarrationStore((s) => s.musicBlob);
  const musicName = useNarrationStore((s) => s.musicName);
  const setMusic = useNarrationStore((s) => s.setMusic);
  const musicInputRef = useRef<HTMLInputElement>(null);

  // ----- Playback -----
  const [playing, setPlaying] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState<number>(-1);
  const runIdRef = useRef(0);
  // Audio mixer wraps the Web Audio graph. Created lazily on first play
  // so we don't spin one up for users who never preview. We rebuild it
  // each play() so a previously-closed context (e.g. after a long idle
  // period) doesn't haunt us — the cost is negligible.
  const mixerRef = useRef<AudioMixer | null>(null);
  // Whether the mixer needs the latest music blob loaded into it. Set
  // true on any control change that the mixer can't see (e.g. swapping
  // the music file); play() re-syncs before starting.
  const musicDirtyRef = useRef(true);

  // Push slider/toggle changes into the live mixer if one's running.
  useEffect(() => { mixerRef.current?.setVoiceVolume(voiceVolume); }, [voiceVolume]);
  useEffect(() => { mixerRef.current?.setMusicVolume(musicVolume); }, [musicVolume]);
  useEffect(() => { mixerRef.current?.setAutoDuck(autoDuck); }, [autoDuck]);
  useEffect(() => { musicDirtyRef.current = true; }, [musicBlob]);

  const stop = () => {
    runIdRef.current++;
    window.speechSynthesis?.cancel();
    if (mixerRef.current) {
      mixerRef.current.stopVoice();
      mixerRef.current.stopMusic();
    }
    setPlaying(false);
    setCurrentLineIdx(-1);
  };

  const ensureMixer = async (): Promise<AudioMixer> => {
    if (!mixerRef.current) {
      mixerRef.current = new AudioMixer({
        voiceVolume, musicVolume, autoDuck,
      });
      musicDirtyRef.current = true;
    }
    if (musicDirtyRef.current) {
      await mixerRef.current.setMusic(musicBlob);
      musicDirtyRef.current = false;
    }
    return mixerRef.current;
  };

  const play = async () => {
    if (voiceKind === 'neural') {
      const ok = await ensureNeuralLoaded();
      if (!ok) return;
    } else {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
    }
    const mixer = voiceKind === 'neural' || musicBlob ? await ensureMixer() : null;
    const runId = ++runIdRef.current;
    setPlaying(true);

    // Kick off music ahead of the first voice line so the duck attack on
    // line 1 has something to lower.
    if (mixer && musicBlob) mixer.startMusic();

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

      if (kokoroVoiceId && mixer) {
        await speakWithKokoroThroughMixer(line.text, kokoroVoiceId, mixer);
      } else {
        await speakWithOs(line.text, osVoice);
      }

      if (runIdRef.current !== runId) return;
      await wait(180);
    }
    if (mixer) mixer.stopMusic();
    setPlaying(false);
    setCurrentLineIdx(-1);
  };

  // Cleanup the AudioContext on unmount so we don't leak.
  useEffect(() => () => {
    runIdRef.current++;
    mixerRef.current?.destroy();
    mixerRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  // The Share modal keeps NarrationPreview mounted while it fades out, so
  // the unmount cleanup above doesn't fire on modal close. Subscribe to
  // shareOpen and stop the active narration when it flips false.
  const shareOpen = useUiStore((s) => s.shareOpen);
  useEffect(() => {
    if (!shareOpen) stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareOpen]);

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

      {/* Background music + mix sliders. Music routes through the
          AudioMixer's gain/duck graph so the user hears the same mix the
          Phase 1d export pipeline will capture. */}
      <details className="panel-tight p-2.5">
        <summary className="text-[11px] text-ink-muted cursor-pointer select-none flex items-center gap-1.5">
          <Music size={11} className="text-accent" />
          Background music &amp; mix
        </summary>
        <div className="mt-2.5 flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-muted">Music</span>
            {musicBlob ? (
              <div className="flex items-center gap-1.5 text-[11px]">
                <span className="text-ink truncate max-w-[140px]" title={musicName ?? 'Uploaded'}>{musicName ?? 'Uploaded'}</span>
                <button
                  className="btn-icon h-6 w-6"
                  onClick={() => setMusic(null, null)}
                  title="Remove music"
                  aria-label="Remove music"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                className="btn h-7 text-[11px] gap-1.5 px-2"
                onClick={() => musicInputRef.current?.click()}
              >
                <Upload size={10} /> Upload audio
              </button>
            )}
            <input
              ref={musicInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setMusic(file, file.name);
                e.target.value = '';
              }}
            />
          </div>

          <VolumeSlider label="Voice"  value={voiceVolume} onChange={setVoiceVolume} />
          <VolumeSlider label="Music"  value={musicVolume} onChange={setMusicVolume} />

          <label className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-ink-muted">Auto-duck music under voice</span>
            <input
              type="checkbox"
              className="accent-accent"
              checked={autoDuck}
              onChange={(e) => setAutoDuck(e.target.checked)}
            />
          </label>

          <p className="text-[10px] text-ink-faint leading-relaxed">
            Bundled CC0 tracks (tense classical, cinematic build, upbeat puzzle) are coming. For now, upload your own — any audio file works.
          </p>
        </div>
      </details>

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

function VolumeSlider({
  label, value, onChange,
}: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-[11px]">
      <span className="text-ink-muted w-12 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-accent"
      />
      <span className="text-ink-faint w-8 text-right tabular-nums">{Math.round(value * 100)}%</span>
    </label>
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

async function speakWithKokoroThroughMixer(
  text: string,
  voiceId: string,
  mixer: AudioMixer,
): Promise<void> {
  const { samples, sampleRate } = await synthesize(text, { voice: voiceId });
  // Copy through a fresh Float32Array — kokoro returns ArrayBufferLike
  // which TS 5.7+'s narrower lib.dom rejects for copyToChannel.
  const channel = new Float32Array(samples.length);
  channel.set(samples);
  const buffer = mixer.ctx.createBuffer(1, channel.length, sampleRate);
  buffer.copyToChannel(channel, 0);
  return mixer.playVoice(buffer);
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
