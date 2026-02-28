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
      },
      '/dl': {
        target: 'https://dl.opensubtitles.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dl/, '')
      },
      '/dl-www': {
        target: 'https://www.opensubtitles.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dl-www/, '')
      }
    },
  },
})
