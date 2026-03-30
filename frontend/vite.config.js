import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',   // force localhost, not 127.0.0.1
    port: 5173,
  },
})
