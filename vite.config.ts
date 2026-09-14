import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import proxyHandler from './api/proxy-sheet.ts';

// Vite dev server plugin to emulate serverless proxy during local development
const proxySheetPlugin = () => ({
  name: 'proxy-sheet-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && (req.url.startsWith('/api/proxy-sheet') || req.url.startsWith('/api/fetch-sheet'))) {
        await proxyHandler(req, res);
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), proxySheetPlugin()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            if (id.includes('@supabase')) {
              return 'supabase-vendor';
            }
            if (id.includes('lucide-react')) {
              return 'lucide-icons';
            }
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('dompurify')) {
              return 'export-tools';
            }
          }
        }
      }
    }
  }
});
