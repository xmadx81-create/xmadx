import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/web-mvp',
  publicDir: false,
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    open: '/hub.html',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/web-mvp'),
    },
  },
});
