import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: '0.0.0.0', // Bind to all interfaces for Docker
    open: true,
    // SECURITY: Restrict file serving
    fs: {
      strict: true,
      allow: [
        // Only allow serving from these directories
        'src',
        'public',
        'node_modules/@vitejs/plugin-react',
        'node_modules/vite',
        'node_modules/.vite'
      ],
      // Explicitly deny sensitive files
      deny: [
        'appSettings.json',
        '.env*',
        'package.json',
        'vite.config.ts',
        'tsconfig.json',
        '../backend',
        '../agent',
        '*.key',
        '*.pem'
      ]
    },
    proxy: {
      '/ohlcv': 'http://localhost:8000',
      '/tokens': 'http://localhost:8000',
      '/portfolio': 'http://localhost:8000',
      '/refresh': 'http://localhost:8000',
      '/token_holdings': 'http://localhost:8000',
      '/defi': 'http://localhost:8000'
    }
  }
}) 