import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/web-mvp',
  publicDir: false,
  base: process.env.NETLIFY ? '/' : (process.env.BASE_URL || '/xmadx/'),
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, 'src/web-mvp/hub.html'),
    },
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
