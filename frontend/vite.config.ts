import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Required for Docker to accept external connections
    port: 3000,
    watch: {
      usePolling: true, // Required for hot reload on Windows with Docker volumes
    },
    proxy: {
      '/api': {
        // In Docker Compose, target the backend service name
        target: 'http://backend:8000',
        changeOrigin: true,
      },
      '/ws': {
        // In Docker Compose, target the backend service name
        target: 'ws://backend:8000',
        ws: true,
        changeOrigin: true,
      }
    }
  }
})
