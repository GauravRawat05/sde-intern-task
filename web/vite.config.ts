// ==============================================================================
// VITE BUILD TOOL CONFIGURATION (vite.config.ts)
// ==============================================================================
// Vite is used here as the frontend development server and bundler.
// This file registers plugins: React (for JSX and fast refresh), TanStack Router
// (for auto code-splitting and client routing), and TailwindCSS (for utility styles).
// It also sets up a local proxy routing all requests from `/api` to the Hono API
// server running on localhost:8787.
// ==============================================================================
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://localhost:8787',
    },
  },
})
