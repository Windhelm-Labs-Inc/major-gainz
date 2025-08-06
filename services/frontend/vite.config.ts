import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Runtime paths – same bundle works everywhere
const apiBase   = process.env.VITE_API_BASE || '/api'
const ragBase   = process.env.VITE_RAG_BASE || '/mcp'
const backendPort = process.env.BACKEND_PORT || '8000'
const backendUrl = `http://127.0.0.1:${backendPort}`

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
      [apiBase]: backendUrl,
      [ragBase]: backendUrl,
    }
  },
  
  // PREVIEW SERVER: Serves built files only (SECURE!)
  preview: {
    port: 8080,
    allowedHosts: 'all', // Allow all hosts for Docker development
    host: '0.0.0.0',
    open: false,
    proxy: {
      [apiBase]: backendUrl,
      [ragBase]: backendUrl,
    }
  },
  
  // Environment variables (safe to bundle)
  define: {
    __WALLETCONNECT_PROJECT_ID__: JSON.stringify(process.env.VITE_WALLETCONNECT_PROJECT_ID || '0e73bf40d90f03a83b1fed4375e5fe04'),
    __HEDERA_NETWORK__: JSON.stringify(process.env.VITE_HEDERA_NETWORK || 'mainnet')
  }
}) 