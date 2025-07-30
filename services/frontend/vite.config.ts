import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
    open: true,
    fs: {
      strict: true,
      allow: ['src', 'public'], // Minimal for dev only
      deny: ['appSettings.json', '.env*', '../*', '*.config.*']
    },
    proxy: {
      '/ohlcv': 'http://localhost:8000',
      '/tokens': 'http://localhost:8000', 
      '/portfolio': 'http://localhost:8000',
      '/refresh': 'http://localhost:8000',
      '/token_holdings': 'http://localhost:8000',
      '/defi': 'http://localhost:8000',
      '/chat': 'http://localhost:8000'
    }
  },
  
  // PREVIEW SERVER: Serves built files only (SECURE!)
  preview: {
    port: 3000,
    host: '0.0.0.0',
    open: true,
    proxy: {
      '/ohlcv': 'http://localhost:8000',
      '/tokens': 'http://localhost:8000',
      '/portfolio': 'http://localhost:8000', 
      '/refresh': 'http://localhost:8000',
      '/token_holdings': 'http://localhost:8000',
      '/defi': 'http://localhost:8000',
      '/chat': 'http://localhost:8000'
    }
  },
  
  // Environment variables (safe to bundle)
  define: {
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(process.env.VITE_WALLETCONNECT_PROJECT_ID || '0e73bf40d90f03a83b1fed4375e5fe04'),
    __HEDERA_NETWORK__: JSON.stringify(process.env.VITE_HEDERA_NETWORK || 'mainnet')
  }
}) 