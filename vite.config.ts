import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import proxyHandler from './api/proxy-sheet.ts';
import adminAuthHandler from './api/admin-auth.ts';

// Vite dev server plugin to emulate serverless proxy and admin auth during local development
const devApiPlugin = () => ({
  name: 'dev-api-plugin',
  configureServer(server: any) {
    server.middlewares.use(async (req: any, res: any, next: any) => {
      if (req.url && (req.url.startsWith('/api/proxy-sheet') || req.url.startsWith('/api/fetch-sheet'))) {
        await proxyHandler(req, res);
      } else if (req.url && req.url.startsWith('/api/auth/')) {
        await adminAuthHandler(req, res);
      } else {
        next();
      }
    });
  }
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiPlugin()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (id.includes('react/') || id.includes('react-dom/')) {
              return 'react-vendor';
            }
            if (id.includes('@supabase/')) {
              return 'supabase-vendor';
            }
          }
        }
      }
    }
  }
});
