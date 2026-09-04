import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// dev-only proxy; override via env: VITE_TENANT_TARGET (falls back to VITE_INTEL_TARGET or localhost)
const tenantTarget = process.env.VITE_TENANT_TARGET || process.env.VITE_INTEL_TARGET || 'http://localhost:9091'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api/v1': { target: tenantTarget, changeOrigin: true },
    },
  },
})
