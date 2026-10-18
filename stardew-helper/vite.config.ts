import { defineConfig } from 'vite';

export default defineConfig({
  // relative paths — иначе собранный index.html не откроется по file://
  base: './',
  server: { port: 5173, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome128',
  },
});
