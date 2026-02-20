import path from "path"
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import pkg from './package.json'

// Auto-generated build metadata — updates on every deploy/build
const buildDate = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })

/**
 * Vite plugin that writes `version.json` into the build output.
 * The useVersionCheck hook compares this against __APP_VERSION__
 * to detect stale client caches after a new deploy.
 */
function versionJsonPlugin(): Plugin {
  return {
    name: 'version-json',
    apply: 'build', // only runs during `vite build`, not dev
    closeBundle() {
      const versionData = {
        version: pkg.version,
        buildTime: new Date().toISOString(),
      }
      const outDir = path.resolve(__dirname, 'dist')
      // Ensure dist exists (Vite creates it, but just in case)
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true })
      }
      fs.writeFileSync(
        path.join(outDir, 'version.json'),
        JSON.stringify(versionData, null, 2),
      )
      console.log(`\n  ✅ version.json written → v${pkg.version}\n`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    versionJsonPlugin(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
  build: {
    sourcemap: false, // Security: don't expose source code in production
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    open: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
