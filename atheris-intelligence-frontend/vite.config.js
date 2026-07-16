import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/onboarding': { target: 'http://localhost:9091', changeOrigin: true },
      '/api/v1/license': { target: 'http://localhost:9091', changeOrigin: true },
    },
  },
})
