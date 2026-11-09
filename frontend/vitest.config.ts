import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Placeholder Supabase env so suites importing @/lib/supabase don't throw in CI (no .env there)
    env: {
      VITE_SUPABASE_URL: 'https://test.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
    },
    include: ['src/**/*.test.{ts,tsx}'],
    // kx.css / index.css are read with ?raw by the motion-token and design-guard tests
    css: { include: [/kx.css/, /index.css/] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
