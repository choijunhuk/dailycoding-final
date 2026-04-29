import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const allowedHosts = (process.env.VITE_ALLOWED_HOSTS || 'localhost,127.0.0.1')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean)

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
    historyApiFallback: true,
  },
})
