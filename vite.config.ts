import { defineConfig } from 'vitest/config';
import { lektionenPlugin, serviceWorkerPlugin } from './vite-plugin-lektionen.ts';

export default defineConfig({
  // GitHub Pages: https://<user>.github.io/voci-trainer/
  base: '/voci-trainer/',
  plugins: [lektionenPlugin(), serviceWorkerPlugin()],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
