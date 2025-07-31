import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Determine backend URL based on environment
// In Docker: backend is internal on localhost
// In local dev: backend is on 0.0.0.0 (for cross-platform compatibility)
const backendUrl = process.env.DOCKER_ENV === 'true' ? 'http://127.0.0.1:8000' : 'http://0.0.0.0:8000'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // SECURE BUILD: Bundle everything, expose nothing
  build: {
    outDir: 'dist',
    sourcemap: false, // No source maps in production
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2']
        }
      }
    }
  },
  
  // DEV SERVER: Restricted (only for fast development)
  server: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
    fs: {
      strict: true,
      allow: ['src', 'public'], // Minimal for dev only
      deny: ['appSettings.json', '.env*', '../*', '*.config.*']
    },
    proxy: {
      '/ohlcv': backendUrl,
      '/tokens': backendUrl, 
      '/portfolio': backendUrl,
      '/refresh': backendUrl,
      '/token_holdings': backendUrl,
      '/defi': backendUrl,
      '/chat': backendUrl
    }
  },
  
  // PREVIEW SERVER: Serves built files only (SECURE!)
  preview: {
    port: 3000,
    host: '0.0.0.0',
    open: false,
    proxy: {
      '/ohlcv': backendUrl,
      '/tokens': backendUrl,
      '/portfolio': backendUrl, 
      '/refresh': backendUrl,
      '/token_holdings': backendUrl,
      '/defi': backendUrl,
      '/chat': backendUrl
    }
  },
  
  // Environment variables (safe to bundle)
  define: {
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(process.env.VITE_WALLETCONNECT_PROJECT_ID || '0e73bf40d90f03a83b1fed4375e5fe04'),
    __HEDERA_NETWORK__: JSON.stringify(process.env.VITE_HEDERA_NETWORK || 'mainnet')
  }
}) 