/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Serves the Vercel function in /api during `npm run dev`, so no Vercel CLI is needed locally. */
function devApi(): Plugin {
  return {
    name: 'dev-api',
    configureServer(server) {
      server.middlewares.use('/api/league', async (req, res) => {
        const { nodeHandler } = await server.ssrLoadModule('/server/node.ts')
        await nodeHandler(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApi()],
  css: {
    preprocessorOptions: {
      scss: {
        // Every .scss file gets the shared mixins (dark mode, hover, breakpoints) without an explicit @use.
        loadPaths: [fileURLToPath(new URL('./src/styles', import.meta.url))],
        additionalData: '@use "mixins" as *;\n',
      },
    },
  },
  build: {
    // Mantine is ~230 KB gzipped in one chunk — fine for this app, so don't warn about it.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'node',
  },
})
