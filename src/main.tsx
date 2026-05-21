import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './core/store/gameStore'
import { useUiStore } from './core/store/uiStore'
import { usePuzzleStore } from './core/store/puzzleStore'

// In dev only, expose the Zustand stores so a developer can poke at state
// from the browser console. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __gambit: unknown }).__gambit = {
    game: useGameStore,
    ui: useUiStore,
    puzzles: usePuzzleStore,
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
