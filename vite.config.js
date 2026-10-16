import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const r = (p) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);
// Several dev servers can run side by side: `API_PORT=8791 vite --port 5181` proxies to that Worker.
const API_PORT = process.env.API_PORT || '8787';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': r('shared'), '@': r('src') } },
  server: {
    host: true,
    port: 5173,
    // `npm run dev` (Vite) + `npx wrangler dev` (Worker on :8787) side by side
    proxy: {
      '/api': `http://127.0.0.1:${API_PORT}`,
      '/ws': { target: `ws://127.0.0.1:${API_PORT}`, ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    include: ['shared/**/*.test.js', 'worker/**/*.test.js', 'src/**/*.test.js'],
    environment: 'node',
  },
});
