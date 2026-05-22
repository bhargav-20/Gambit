import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BoardThemeId = 'midnight' | 'wood' | 'tournament' | 'ivory' | 'neon';
/**
 * App-wide background — affects the body fill, most visibly on Home and the
 * catalog landings (board routes have a board covering most of the viewport).
 *   midnight  — radial gradients on near-black; quiet, editorial.
 *   checkered — subtle 80px chessboard pattern at very low opacity.
 *   aurora    — mesh of violet/teal/pink radials over a bluer black.
 *   wood      — warm amber/umber radials evoking a tournament wooden set.
 */
export type AppBackgroundId = 'midnight' | 'checkered' | 'aurora' | 'wood';
export type PieceSetId =
  | 'cburnett'
  | 'merida'
  | 'alpha'
  | 'staunty'
  | 'chess7'
  | 'california'
  | 'horsey'
  | 'maestro'
  | 'pixel'
  | 'fantasy'
  | 'letter';
export type RenderMode = '2d' | '3d';

export type PanelView = 'openings' | 'import' | 'export' | 'settings' | 'puzzles' | 'pvp';
/** Which bottom-sheet is open on mobile; null = closed.
 *  `tools` is route-aware — same slot, content swaps based on the URL
 *  (openings catalog / puzzle UI / import / engine controls). */
export type MobileSheet = 'moves' | 'idea' | 'tools' | 'match' | null;

interface UiState {
  boardTheme: BoardThemeId;
  appBackground: AppBackgroundId;
  pieceSet: PieceSetId;
  renderMode: RenderMode;
  showCoords: boolean;
  showLastMove: boolean;
  showLegalDots: boolean;
  /**
   * How the engine's best-move arrow is surfaced on the board (analyze/compose only):
   *   off   — never shown
   *   on    — always shown while the engine has a result
   *   once  — shown for the current position only; auto-resets to 'off' on
   *           the next ply change. Use this when you want a peek without
   *           committing to permanent visualization.
   */
  bestMoveDisplay: 'off' | 'on' | 'once';
  animationMs: number;
  activePanel: PanelView;
  mobileSheet: MobileSheet;
  /** Mute PvP sound cues (move click, low-time tick, flag, start, end). */
  pvpMuted: boolean;
  /** Activity sidebar — pinned-open on desktop, slide-over on mobile. Persisted
   *  on desktop only; the slide-over should never start open on a fresh load. */
  navOpen: boolean;
  /** Settings slide-over open state (driven by the gear button + /settings route). */
  settingsOpen: boolean;
  /** Share modal open state — covers PGN/FEN/link copy and video export. */
  shareOpen: boolean;
  /** Import modal open state — paste PGN/FEN, URL fetch, fresh board. */
  importOpen: boolean;
  setBoardTheme: (t: BoardThemeId) => void;
  setAppBackground: (b: AppBackgroundId) => void;
  setPieceSet: (p: PieceSetId) => void;
  setRenderMode: (m: RenderMode) => void;
  setShowCoords: (v: boolean) => void;
  setShowLastMove: (v: boolean) => void;
  setShowLegalDots: (v: boolean) => void;
  setBestMoveDisplay: (v: 'off' | 'on' | 'once') => void;
  setAnimationMs: (ms: number) => void;
  setActivePanel: (p: PanelView) => void;
  setMobileSheet: (s: MobileSheet) => void;
  setPvpMuted: (v: boolean) => void;
  setNavOpen: (v: boolean) => void;
  toggleNav: () => void;
  setSettingsOpen: (v: boolean) => void;
  setShareOpen: (v: boolean) => void;
  setImportOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      boardTheme: 'midnight',
      appBackground: 'midnight',
      pieceSet: 'cburnett',
      renderMode: '2d',
      showCoords: true,
      showLastMove: true,
      showLegalDots: true,
      bestMoveDisplay: 'off',               // off by default — user opts in per-position
      animationMs: 220,
      activePanel: 'openings',
      mobileSheet: null,
      pvpMuted: false,
      navOpen: true,
      settingsOpen: false,
      shareOpen: false,
      importOpen: false,
      setBoardTheme: (t) => set({ boardTheme: t }),
      setAppBackground: (b) => set({ appBackground: b }),
      setPieceSet: (p) => set({ pieceSet: p }),
      setRenderMode: (m) => set({ renderMode: m }),
      setShowCoords: (v) => set({ showCoords: v }),
      setShowLastMove: (v) => set({ showLastMove: v }),
      setShowLegalDots: (v) => set({ showLegalDots: v }),
      setBestMoveDisplay: (v) => set({ bestMoveDisplay: v }),
      setAnimationMs: (ms) => set({ animationMs: ms }),
      setActivePanel: (p) => set({ activePanel: p }),
      setMobileSheet: (s) => set({ mobileSheet: s }),
      setPvpMuted: (v) => set({ pvpMuted: v }),
      setNavOpen: (v) => set({ navOpen: v }),
      toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      setShareOpen: (v) => set({ shareOpen: v }),
      setImportOpen: (v) => set({ importOpen: v }),
    }),
    {
      name: 'gambit:ui',
      // Don't persist transient UI state — the mobile sheet should always start
      // closed on a fresh page load.
      partialize: (s) => ({
        boardTheme: s.boardTheme,
        appBackground: s.appBackground,
        pieceSet: s.pieceSet,
        renderMode: s.renderMode,
        showCoords: s.showCoords,
        showLastMove: s.showLastMove,
        showLegalDots: s.showLegalDots,
        // bestMoveDisplay intentionally NOT persisted — it's a per-session affordance.
        animationMs: s.animationMs,
        activePanel: s.activePanel,
        pvpMuted: s.pvpMuted,
        navOpen: s.navOpen,
      }),
    },
  ),
);
