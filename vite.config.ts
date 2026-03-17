import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Manual chunk splitting: vendor libs in their own bundle
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('recharts') || id.includes('d3-')) return 'recharts';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/') ||
              id.includes('react-router')) return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
});
