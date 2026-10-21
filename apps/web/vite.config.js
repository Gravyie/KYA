import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

const api = process.env.VITE_API_URL || 'http://127.0.0.1:5055';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1', port: 5173, strictPort: true,
    fs: {allow: ['../..']}, // the playground imports the server's pure policy module
    proxy: {'/api': {target: api, changeOrigin: true}, '/health': {target: api, changeOrigin: true}},
  },
  build: {
    outDir: 'dist', sourcemap: false,
    rollupOptions: {output: {manualChunks: id => (id.includes('node_modules/three') ? 'three' : undefined)}},
  },
});
