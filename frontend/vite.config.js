import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/classic': 'http://localhost:8080'
    }
  },
  build: {
    outDir: '../src/main/resources/static',
    emptyOutDir: false
  }
})
