import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/admin': { target: 'http://localhost:9090', changeOrigin: true },
      '/api/v1/platform': { target: 'http://localhost:9090', changeOrigin: true },
      '/api/v1/intelligence': { target: 'http://localhost:9090', changeOrigin: true },
      '/api/v1/auth': { target: 'http://localhost:9090', changeOrigin: true },
      '/api/v1/recommendations': { target: 'http://localhost:9090', changeOrigin: true },
      '/api/v1/onboarding': { target: 'http://localhost:9091', changeOrigin: true },
      '/api/v1/license': { target: 'http://localhost:9091', changeOrigin: true },
    },
  },
})
