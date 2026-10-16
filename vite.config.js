import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const r = (p) => path.resolve(path.dirname(fileURLToPath(import.meta.url)), p);

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@shared': r('shared'), '@': r('src') } },
  server: {
    host: true,
    port: 5173,
    // `npm run dev` (Vite) + `npx wrangler dev` (Worker on :8787) side by side
    proxy: {
      '/api': 'http://localhost:8787',
      '/ws': { target: 'ws://localhost:8787', ws: true },
    },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    include: ['shared/**/*.test.js', 'worker/**/*.test.js', 'src/**/*.test.js'],
    environment: 'node',
  },
});
