import { useEffect, useMemo } from 'react';
import './chessgroundBase.css';
import { useUiStore } from '@/core/store/uiStore';
import { findBoardTheme } from './boardThemes';
import { pieceSetCss } from './piecesets';
import { checkerboardBackground } from './boardBackground';
import { findAppBackground } from './appBackgrounds';

/**
 * Injects board-theme CSS variables, the checkerboard background image,
 * the piece-set background-images, and the body's background fill +
 * pattern (driven by the user's appBackground setting). Mounted once at
 * the app root.
 */
export function ThemeStyles() {
  const boardTheme = useUiStore((s) => s.boardTheme);
  const pieceSet = useUiStore((s) => s.pieceSet);
  const appBackground = useUiStore((s) => s.appBackground);

  const theme = useMemo(() => findBoardTheme(boardTheme), [boardTheme]);
  const bg = useMemo(() => findAppBackground(appBackground), [appBackground]);

  const css = useMemo(() => {
    return `
      :root {
        --cg-light: ${theme.light};
        --cg-dark: ${theme.dark};
        --cg-coords: ${theme.coordsColor};
        --cg-last-move: ${theme.lastMove};
        --cg-selected: ${theme.selected};
        --cg-dot: ${theme.dot};
        --cg-shadow: ${theme.shadow};
      }
      body {
        background-color: ${bg.base};
        background-image: ${bg.image};
        ${bg.size ? `background-size: ${bg.size};` : ''}
        background-attachment: fixed;
      }
      cg-board {
        background-image: ${checkerboardBackground(theme.light, theme.dark)};
      }
      ${pieceSetCss(pieceSet)}
    `;
  }, [theme, pieceSet, bg]);

  useEffect(() => {
    let el = document.getElementById('shatran-board-theme') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'shatran-board-theme';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, [css]);

  return null;
}
