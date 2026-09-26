import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'
import { env } from 'node:process'

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:5005',
    changeOrigin: true,
  },
}

export default defineConfig({
  root: fileURLToPath(new URL('./frontend', import.meta.url)),
  plugins: [react()],
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  server: {
    port: 5316,
    strictPort: true,
    allowedHosts: env.FOOD_APP_HOST ? [env.FOOD_APP_HOST] : [],
    proxy: apiProxy,
  },
  preview: {
    port: 5316,
    strictPort: true,
    allowedHosts: env.FOOD_APP_HOST ? [env.FOOD_APP_HOST] : [],
    proxy: apiProxy,
  },
})
