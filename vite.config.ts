import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { target: 'es2022', chunkSizeWarningLimit: 1300 },
  server: { port: 5173, strictPort: true },
});
