import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type BoardThemeId = 'midnight' | 'wood' | 'tournament' | 'ivory' | 'neon';
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
 *  `catalog` swaps content based on the current route (openings vs puzzles). */
export type MobileSheet = 'moves' | 'idea' | 'catalog' | 'match' | null;

interface UiState {
  boardTheme: BoardThemeId;
  pieceSet: PieceSetId;
  renderMode: RenderMode;
  showCoords: boolean;
  showLastMove: boolean;
  showLegalDots: boolean;
  /** Show the engine's best-move arrow on the board (only in Analysis mode). */
  showBestMove: boolean;
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
  /** Export modal open state (driven by the Export icon in the TopBar). */
  exportOpen: boolean;
  setBoardTheme: (t: BoardThemeId) => void;
  setPieceSet: (p: PieceSetId) => void;
  setRenderMode: (m: RenderMode) => void;
  setShowCoords: (v: boolean) => void;
  setShowLastMove: (v: boolean) => void;
  setShowLegalDots: (v: boolean) => void;
  setShowBestMove: (v: boolean) => void;
  setAnimationMs: (ms: number) => void;
  setActivePanel: (p: PanelView) => void;
  setMobileSheet: (s: MobileSheet) => void;
  setPvpMuted: (v: boolean) => void;
  setNavOpen: (v: boolean) => void;
  toggleNav: () => void;
  setSettingsOpen: (v: boolean) => void;
  setExportOpen: (v: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      boardTheme: 'midnight',
      pieceSet: 'cburnett',
      renderMode: '2d',
      showCoords: true,
      showLastMove: true,
      showLegalDots: true,
      showBestMove: false,                  // off by default — user opts in per-position
      animationMs: 220,
      activePanel: 'openings',
      mobileSheet: null,
      pvpMuted: false,
      navOpen: true,
      settingsOpen: false,
      exportOpen: false,
      setBoardTheme: (t) => set({ boardTheme: t }),
      setPieceSet: (p) => set({ pieceSet: p }),
      setRenderMode: (m) => set({ renderMode: m }),
      setShowCoords: (v) => set({ showCoords: v }),
      setShowLastMove: (v) => set({ showLastMove: v }),
      setShowLegalDots: (v) => set({ showLegalDots: v }),
      setShowBestMove: (v) => set({ showBestMove: v }),
      setAnimationMs: (ms) => set({ animationMs: ms }),
      setActivePanel: (p) => set({ activePanel: p }),
      setMobileSheet: (s) => set({ mobileSheet: s }),
      setPvpMuted: (v) => set({ pvpMuted: v }),
      setNavOpen: (v) => set({ navOpen: v }),
      toggleNav: () => set((s) => ({ navOpen: !s.navOpen })),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      setExportOpen: (v) => set({ exportOpen: v }),
    }),
    {
      name: 'gambit:ui',
      // Don't persist transient UI state — the mobile sheet should always start
      // closed on a fresh page load.
      partialize: (s) => ({
        boardTheme: s.boardTheme,
        pieceSet: s.pieceSet,
        renderMode: s.renderMode,
        showCoords: s.showCoords,
        showLastMove: s.showLastMove,
        showLegalDots: s.showLegalDots,
        // showBestMove intentionally NOT persisted — it's a per-session affordance.
        animationMs: s.animationMs,
        activePanel: s.activePanel,
        pvpMuted: s.pvpMuted,
        navOpen: s.navOpen,
      }),
    },
  ),
);
