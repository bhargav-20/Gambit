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

export type PanelView = 'openings' | 'import' | 'export' | 'settings' | 'puzzles';
/** Which bottom-sheet is open on mobile; null = closed. */
export type MobileSheet = 'moves' | 'idea' | 'browse' | null;

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
      }),
    },
  ),
);
