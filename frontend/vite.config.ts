import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:5000',
      '/drive': 'http://localhost:5000',
      '/local': 'http://localhost:5000',
      '/transfer': 'http://localhost:5000',
      '/health': 'http://localhost:5000',
    },
  },
})
