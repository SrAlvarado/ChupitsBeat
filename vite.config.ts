import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/ChupitsBeat/',
  server: {
    port: 5180,
    strictPort: true, // no caer a 5173/5174 — deja esos puertos para otra app
  },
})
