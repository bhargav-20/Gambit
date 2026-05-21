import type { BoardThemeId } from '@/core/store/uiStore';

export interface BoardTheme {
  id: BoardThemeId;
  label: string;
  light: string;
  dark: string;
  coordsColor: string;
  lastMove: string;
  selected: string;
  dot: string;       // legal-move dot color
  shadow: string;
}

export const BOARD_THEMES: BoardTheme[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    light: '#7a8597',
    dark: '#2f3645',
    coordsColor: 'rgba(231, 233, 238, 0.7)',
    lastMove: 'rgba(233, 180, 101, 0.45)',
    selected: 'rgba(233, 180, 101, 0.6)',
    dot: 'rgba(233, 180, 101, 0.7)',
    shadow: '0 30px 60px -20px rgba(0,0,0,0.6)',
  },
  {
    id: 'wood',
    label: 'Classic Wood',
    // Lichess's classic wood — high contrast for both piece colors.
    light: '#f0d9b5',
    dark: '#b58863',
    coordsColor: 'rgba(30, 20, 10, 0.7)',
    lastMove: 'rgba(255, 220, 80, 0.5)',
    selected: 'rgba(255, 200, 60, 0.65)',
    dot: 'rgba(60, 30, 10, 0.6)',
    shadow: '0 30px 60px -20px rgba(80, 50, 20, 0.6)',
  },
  {
    id: 'tournament',
    label: 'Tournament',
    // Lichess green — the set Cburnett was designed against.
    light: '#eeeed2',
    dark: '#769656',
    coordsColor: 'rgba(20, 30, 20, 0.75)',
    lastMove: 'rgba(255, 220, 80, 0.5)',
    selected: 'rgba(255, 200, 60, 0.65)',
    dot: 'rgba(30, 60, 30, 0.55)',
    shadow: '0 30px 60px -20px rgba(20, 60, 30, 0.45)',
  },
  {
    id: 'ivory',
    label: 'Ivory',
    // Darken the medium square so black pieces pop more; brighten coords for legibility.
    light: '#efe6d4',
    dark: '#b39977',
    coordsColor: 'rgba(60, 40, 20, 0.8)',
    lastMove: 'rgba(220, 160, 80, 0.5)',
    selected: 'rgba(220, 140, 60, 0.6)',
    dot: 'rgba(80, 50, 20, 0.55)',
    shadow: '0 30px 60px -20px rgba(120, 80, 40, 0.45)',
  },
  {
    id: 'neon',
    label: 'Neon',
    // Lift both squares well clear of #000 so black pieces don't disappear.
    light: '#5a3f8c',
    dark: '#2d1b54',
    coordsColor: 'rgba(255, 180, 240, 0.85)',
    lastMove: 'rgba(255, 120, 220, 0.5)',
    selected: 'rgba(140, 255, 230, 0.6)',
    dot: 'rgba(140, 255, 230, 0.7)',
    shadow: '0 30px 60px -20px rgba(255, 80, 200, 0.45)',
  },
];

export function findBoardTheme(id: BoardThemeId): BoardTheme {
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
