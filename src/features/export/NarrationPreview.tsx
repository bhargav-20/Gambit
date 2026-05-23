import { useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { findOpening } from '@/features/openings/catalog';
import { findGame } from '@/features/games/catalog';
import { generateNarration } from './narration';
import { Mic, Play, Square as StopIcon, ChevronDown } from 'lucide-react';
import clsx from 'clsx';

/**
 * Live preview of the generated narration via the browser's
 * SpeechSynthesis API. Reads the intro, every move's commentary, then the
 * outro, pausing between lines for cadence. Voice picker lists the user's
 * OS-installed voices; nothing downloads.
 *
 * SpeechSynthesis is enough for previewing the prose quality, but its
 * audio doesn't flow through Web Audio, so we can't capture it into the
 * video export. The actual narrated-video path will use a neural TTS
 * (kokoro-js or piper-tts-web) — Phase 1b. This component is the surface
 * that proves the text generator is good before we invest in that.
 *
 * As the playback advances we also nudge the gameStore's `ply` to match,
 * so the board visually moves through the same positions the narration is
 * describing. The user gets a real "play the narrated video without the
 * actual video file yet" rehearsal.
 */
export function NarrationPreview() {
  const game = useGameStore((s) => s.game);
  const goTo = useGameStore((s) => s.goTo);

  // Resolve any catalogued context the loaded game has.
  const opening = game.meta.openingId ? findOpening(game.meta.openingId) : undefined;
  const famous = game.meta.gameId ? findGame(game.meta.gameId) : undefined;

  const script = useMemo(
    () => generateNarration({ game, opening, famousGame: famous }),
    [game, opening, famous],
  );

  // Voice picker. SpeechSynthesis loads voices asynchronously on first
  // access — we subscribe to `voiceschanged` so the picker isn't empty
  // before the OS has populated the list.
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState<string>('');
  useEffect(() => {
    const load = () => {
      const list = window.speechSynthesis?.getVoices() ?? [];
      // Bias toward English voices since the script is English. Otherwise
      // a Spanish system voice would slaughter the chess terminology.
      const sorted = [...list].sort((a, b) => {
        const aEn = a.lang?.startsWith('en') ? 0 : 1;
        const bEn = b.lang?.startsWith('en') ? 0 : 1;
        if (aEn !== bEn) return aEn - bEn;
        return a.name.localeCompare(b.name);
      });
      setVoices(sorted);
      if (sorted.length && !voiceURI) setVoiceURI(sorted[0].voiceURI);
    };
    load();
    window.speechSynthesis?.addEventListener('voiceschanged', load);
    return () => window.speechSynthesis?.removeEventListener('voiceschanged', load);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [playing, setPlaying] = useState(false);
  const [currentLineIdx, setCurrentLineIdx] = useState<number>(-1);
  // Used as a cancellation flag so the in-flight chain stops cleanly when
  // the user hits Stop. Re-bumping on every play() guarantees stale chains
  // don't keep speaking after a stop+restart.
  const runIdRef = useRef(0);

  const stop = () => {
    runIdRef.current++;
    window.speechSynthesis?.cancel();
    setPlaying(false);
    setCurrentLineIdx(-1);
  };

  const play = async () => {
    if (!window.speechSynthesis) return;
    // Reset any previous run.
    window.speechSynthesis.cancel();
    const runId = ++runIdRef.current;
    setPlaying(true);

    const voice = voices.find((v) => v.voiceURI === voiceURI) ?? voices[0];
    const lines: Array<{ text: string; ply?: number; label: string }> = [
      { text: script.intro, label: 'Intro' },
      ...script.perMove.map((text, i) => ({ text, ply: i + 1, label: `Move ${Math.floor(i / 2) + 1}${i % 2 === 0 ? '' : '…'}` })),
      { text: script.outro, label: 'Outro' },
    ];

    for (let i = 0; i < lines.length; i++) {
      if (runIdRef.current !== runId) return; // cancelled
      const line = lines[i];
      setCurrentLineIdx(i);
      if (line.ply !== undefined) goTo(line.ply);
      await speakLine(line.text, voice);
      // Tiny pause between lines for cadence — keeps the playback from
      // sounding like a single run-on paragraph.
      if (runIdRef.current !== runId) return;
      await wait(180);
    }
    setPlaying(false);
    setCurrentLineIdx(-1);
  };

  useEffect(() => () => stop(), []); // stop on unmount

  if (!game.moves.length) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <Mic size={14} className="text-accent" />
        <h3 className="font-display text-sm">Narration preview</h3>
      </div>

      {voices.length > 0 && (
        <label className="flex items-center justify-between gap-2 text-xs">
          <span className="text-ink-muted">Voice</span>
          <div className="relative">
            <select
              className="bg-bg border border-edge rounded px-2 py-1 pr-6 text-xs max-w-[180px] truncate appearance-none"
              value={voiceURI}
              onChange={(e) => setVoiceURI(e.target.value)}
            >
              {voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
          </div>
        </label>
      )}

      {voices.length === 0 && (
        <p className="text-[11px] text-ink-faint">No system voices found. Try a different browser.</p>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <button
          className="btn h-8 text-xs justify-center gap-1.5"
          onClick={play}
          disabled={playing || voices.length === 0}
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

      {/* Script readout — useful when reviewing the prose itself, and gives
          the user a visual cue of which line is currently being spoken. */}
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

/** Speak a single line and resolve when it finishes. We can't await
 *  speechSynthesis.speak() natively, so wrap the onend callback. */
function speakLine(text: string, voice?: SpeechSynthesisVoice): Promise<void> {
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    // Slightly slower than default for chess prose — the move names and
    // square coordinates are dense and hard to follow at full speed.
    u.rate = 0.95;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
