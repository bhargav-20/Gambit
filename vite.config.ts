import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  // Project Pages live at https://<user>.github.io/<repo>/, so all asset URLs
  // need the repo name as a prefix. Vite uses this for both `index.html`
  // injection and `import.meta.env.BASE_URL`, which the Stockfish loader
  // reads — so don't change one without the other.
  base: '/Gambit/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
});
