import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // The API is proxied so the browser makes same-origin calls. One less thing
    // to misconfigure on a conference network, and no CORS surprises on stage.
    proxy: {
      '/api': {target: process.env.VITE_API_URL || 'http://127.0.0.1:5055', changeOrigin: true},
      '/health': {target: process.env.VITE_API_URL || 'http://127.0.0.1:5055', changeOrigin: true},
    },
  },
  build: {outDir: 'dist', sourcemap: false},
});
