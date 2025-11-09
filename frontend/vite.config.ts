import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'maplibre-gl',
      'react-map-gl',
      '@deck.gl/core',
      '@deck.gl/layers',
      '@deck.gl/aggregation-layers',
      '@deck.gl/mapbox',
      'd3',
      'framer-motion',
      'gsap'
    ],
    exclude: ['ogl']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'map-vendor': ['maplibre-gl', 'react-map-gl', '@deck.gl/core', '@deck.gl/layers', '@deck.gl/aggregation-layers', '@deck.gl/mapbox'],
          'animation-vendor': ['framer-motion', 'gsap', '@gsap/react'],
          'd3-vendor': ['d3']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  },
  server: {
    hmr: {
      overlay: false
    }
  }
})
