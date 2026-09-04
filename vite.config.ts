import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // Τα γραφήματα είναι το μισό bundle και δεν χρειάζονται στην οθόνη
        // σύνδεσης. Χωριστό chunk σημαίνει ταχύτερο πρώτο άνοιγμα.
        manualChunks: {
          charts: ['recharts'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
});
