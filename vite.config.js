import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],

  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: {
        // Hoofdapp
        main: resolve(__dirname, 'index.html'),
        // Admin-tools (worden meegebuild maar zijn niet gelinkt vanuit de app)
        seed: resolve(__dirname, 'seed.html'),
      },
    },
  },
});
