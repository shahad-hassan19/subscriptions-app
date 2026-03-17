import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    react({
      // When the portal is embedded / reverse-proxied through another origin,
      // Fast Refresh must load its runtime from the Vite dev server origin.
      // Override if needed (e.g. ngrok) via PORTAL_DEV_ORIGIN.
      reactRefreshHost: process.env.PORTAL_DEV_ORIGIN ?? 'http://localhost:3002',
    }),
    tailwindcss(),
  ],
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL ?? ''),
  },
  server: {
    port: 3002,
    strictPort: true,
    proxy: {
      // All /api calls go to the Express server
      '/api': {
        target:       'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});