import { defineConfig } from 'vitest/config';
import { lektionenPlugin } from './vite-plugin-lektionen.ts';

export default defineConfig({
  // GitHub Pages: https://<user>.github.io/voci-trainer/
  base: '/voci-trainer/',
  plugins: [lektionenPlugin()],
  build: {
    target: 'es2022',
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
