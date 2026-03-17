import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? ''),
  },
  server: {
    port: 3001,
    // Proxy /api requests to the Express server during development.
    // This means you call fetch('/api/...') in React — no hardcoded localhost URLs.
    proxy: {
      '/api': {
        target:       'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});