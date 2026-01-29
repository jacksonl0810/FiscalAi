import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: path.resolve(__dirname, '../backend/frontend'),
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true, // Listen on all addresses
    hmr: {
      // Use WebSocket protocol matching the page
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
    proxy: process.env.VITE_API_URL && !process.env.VITE_API_URL.startsWith('/') ? {} : {
      '/api': {
        target: process.env.VITE_BACKEND_URL || `http://localhost:${process.env.VITE_BACKEND_PORT || '3001'}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
});