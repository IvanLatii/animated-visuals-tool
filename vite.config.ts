import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  worker: { format: 'es' },
  build: {
    rollupOptions: { input: { main: 'index.html', spike: 'spike.html' } },
  },
});
