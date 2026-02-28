import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'https://api.opensubtitles.com',
        changeOrigin: true,
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq) => {
            // Modern browsers strip the User-Agent from fetch overrides for security.
            // OpenSubtitles rigorously requires 'User-Agent: AppName vX.Y' to not return 403
            proxyReq.setHeader('User-Agent', 'EDLMaker v1.0');
            // Remove browser origins that might trip Cloudflare
            proxyReq.removeHeader('Origin');
            proxyReq.removeHeader('Referer');
          });
        }
      }
    },
  },
})
