import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  // Absolute, so deep links (/customers/<id>) and refreshes load the scripts. '/' for the console's
  // own domain (admin.claritiy.com); scripts/build_all.js sets ADMIN_BASE=/admin/ for the copy
  // served on the main site.
  base: process.env.ADMIN_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
  ],
  css: {
    postcss: {
      plugins: [],
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          lucide: ['lucide-react'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
  server: {
    port: 5174,
  },
});
