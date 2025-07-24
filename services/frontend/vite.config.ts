import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/ohlcv': 'http://localhost:8000',
      '/tokens': 'http://localhost:8000',
      '/portfolio': 'http://localhost:8000',
      '/refresh': 'http://localhost:8000'
    }
  }
}) 