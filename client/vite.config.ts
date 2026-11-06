import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5177,
    proxy: {
      '/api': {
        target: 'http://localhost:3005',
        changeOrigin: true,
      },
    },
  },
});
