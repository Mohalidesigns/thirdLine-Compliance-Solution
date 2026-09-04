import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev-only proxy; override via env: VITE_INTEL_TARGET / VITE_TENANT_TARGET
const intelTarget = process.env.VITE_INTEL_TARGET || 'http://localhost:9090'
const tenantTarget = process.env.VITE_TENANT_TARGET || 'http://localhost:9091'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/v1/admin': { target: intelTarget, changeOrigin: true },
      '/api/v1/platform': { target: intelTarget, changeOrigin: true },
      '/api/v1/intelligence': { target: intelTarget, changeOrigin: true },
      '/api/v1/auth': { target: intelTarget, changeOrigin: true },
      '/api/v1/recommendations': { target: intelTarget, changeOrigin: true },
      '/api/v1/onboarding': { target: tenantTarget, changeOrigin: true },
      '/api/v1/license': { target: tenantTarget, changeOrigin: true },
    },
  },
})
