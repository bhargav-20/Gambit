import { useEffect, useMemo } from 'react';
import './chessgroundBase.css';
import { useUiStore } from '@/core/store/uiStore';
import { findBoardTheme } from './boardThemes';
import { pieceSetCss } from './piecesets';
import { checkerboardBackground } from './boardBackground';

/**
 * Injects board-theme CSS variables, the checkerboard background image, and
 * the piece-set background-images. Mounted once at the app root.
 */
export function ThemeStyles() {
  const boardTheme = useUiStore((s) => s.boardTheme);
  const pieceSet = useUiStore((s) => s.pieceSet);

  const theme = useMemo(() => findBoardTheme(boardTheme), [boardTheme]);

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
      cg-board {
        background-image: ${checkerboardBackground(theme.light, theme.dark)};
      }
      ${pieceSetCss(pieceSet)}
    `;
  }, [theme, pieceSet]);

  useEffect(() => {
    let el = document.getElementById('gambit-board-theme') as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement('style');
      el.id = 'gambit-board-theme';
      document.head.appendChild(el);
    }
    el.textContent = css;
  }, [css]);

  return null;
}
