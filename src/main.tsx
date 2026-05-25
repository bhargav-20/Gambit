import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import { useGameStore } from './core/store/gameStore'
import { useUiStore } from './core/store/uiStore'
import { usePuzzleStore } from './core/store/puzzleStore'
import { useAnalysisStore } from './core/store/analysisStore'
import { useBotStore } from './core/store/botStore'
import { startPwa } from './features/pwa/register'

// Register service worker + listen for the install prompt before render so
// the SW can claim its scope and `beforeinstallprompt` doesn't fire into a
// listener that hasn't been added yet.
startPwa();

// In dev only, expose the Zustand stores so a developer can poke at state
// from the browser console. Stripped from production builds.
if (import.meta.env.DEV) {
  (window as unknown as { __shatran: unknown }).__shatran = {
    game: useGameStore,
    ui: useUiStore,
    puzzles: usePuzzleStore,
    analysis: useAnalysisStore,
    bot: useBotStore,
  };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* HashRouter chosen over BrowserRouter so GitHub Pages doesn't need an
        SPA fallback — every navigation lives in the URL hash, which the
        server doesn't see. PGN-share URLs already use the hash; our nested
        router co-exists with that via path segments before query strings. */}
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>,
)
