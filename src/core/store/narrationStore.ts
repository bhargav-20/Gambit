import { create } from 'zustand';

/**
 * Narration export config — settings shared between NarrationPreview (which
 * owns the picker UI + playback) and ExportPanel (which owns the Render
 * button that consumes them). Lives in its own store rather than threaded
 * through props so it survives ShareModal close-and-reopen without making
 * the components re-architect their own lifecycle.
 *
 * The audio Blob is a transient handle — we don't persist it across
 * reloads. Users re-upload music each session, which is fine for the
 * v1 narrated-video flow.
 */

export type VoiceKind = 'os' | 'neural';

interface NarrationConfig {
  /** When true and `voiceKind === 'neural'`, the Render button passes a
   *  `narration` option to exportGameToVideo. With 'os' or false it's a
   *  silent export. */
  exportNarration: boolean;

  voiceKind: VoiceKind;
  /** OS voiceURI for 'os', kokoro voice id for 'neural'. */
  voiceId: string;

  musicBlob: Blob | null;
  musicName: string | null;

  voiceVolume: number;
  musicVolume: number;
  autoDuck: boolean;
}

interface NarrationState extends NarrationConfig {
  setExportNarration: (on: boolean) => void;
  setVoiceKind: (k: VoiceKind) => void;
  setVoiceId: (id: string) => void;
  setMusic: (blob: Blob | null, name: string | null) => void;
  setVoiceVolume: (v: number) => void;
  setMusicVolume: (v: number) => void;
  setAutoDuck: (on: boolean) => void;
}

export const useNarrationStore = create<NarrationState>((set) => ({
  exportNarration: false,
  voiceKind: 'os',
  voiceId: '',
  musicBlob: null,
  musicName: null,
  voiceVolume: 1,
  musicVolume: 0.35,
  autoDuck: true,

  setExportNarration: (on) => set({ exportNarration: on }),
  setVoiceKind: (k) => set({ voiceKind: k }),
  setVoiceId: (id) => set({ voiceId: id }),
  setMusic: (blob, name) => set({ musicBlob: blob, musicName: name }),
  setVoiceVolume: (v) => set({ voiceVolume: v }),
  setMusicVolume: (v) => set({ musicVolume: v }),
  setAutoDuck: (on) => set({ autoDuck: on }),
}));
