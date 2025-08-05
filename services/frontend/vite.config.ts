import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Determine backend URL based on environment
// In Docker: backend is internal on localhost
// In local dev: backend is on 0.0.0.0 (for cross-platform compatibility)
const backendUrl = process.env.DOCKER_ENV === 'true' ? 'http://127.0.0.1:8000' : 'http://127.0.0.1:8000'

// https://vitejs.dev/config/
import { dirname, resolve } from 'path'
import { fileURLToPath } from 'url'

const emptyModule = resolve(dirname(fileURLToPath(import.meta.url)), 'src/empty-module.js')

export default defineConfig({
  plugins: [react()],
  
  // SECURE BUILD: Bundle everything, expose nothing
  resolve: {
    alias: {
      'node:stream': 'stream-browserify',
      stream: 'stream-browserify',
      'node:path': 'path-browserify',
      path: 'path-browserify',
      'node:process': 'process/browser',
      process: 'process/browser',
      fs: emptyModule,
      'node:fs': emptyModule,
      child_process: emptyModule,
    },
  },

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
    port: 8080,
    allowedHosts: 'all',
    host: '0.0.0.0',
    open: false,
    fs: {
      strict: true,
      allow: ['src', 'public', 'node_modules'], // Include node_modules for CSS like KaTeX
      deny: ['appSettings.json', '.env*', '../*', '*.config.*']
    },
    proxy: {
      '/ohlcv': backendUrl,
      '/tokens': backendUrl, 
      '/portfolio': backendUrl,
      '/refresh': backendUrl,
      '/token_holdings': backendUrl,
      '/defi': backendUrl,
      '/chat': backendUrl,
      '/mcp': backendUrl
    }
  },
  
  // PREVIEW SERVER: Serves built files only (SECURE!)
  preview: {
    port: 8080,
    allowedHosts: 'all', // Allow all hosts for Docker development
    host: '0.0.0.0',
    open: false,
    proxy: {
      '/ohlcv': 'http://127.0.0.1:8000',
      '/tokens': 'http://127.0.0.1:8000',
      '/portfolio': 'http://127.0.0.1:8000', 
      '/refresh': 'http://127.0.0.1:8000',
      '/token_holdings': 'http://127.0.0.1:8000',
      '/defi': 'http://127.0.0.1:8000',
      '/chat': 'http://127.0.0.1:8000',
      '/mcp': 'http://127.0.0.1:8000'
    }
  },
  
  // Environment variables (safe to bundle)
  define: {
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(process.env.VITE_WALLETCONNECT_PROJECT_ID || '0e73bf40d90f03a83b1fed4375e5fe04'),
    __HEDERA_NETWORK__: JSON.stringify(process.env.VITE_HEDERA_NETWORK || 'mainnet')
  }
}) 