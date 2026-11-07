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
    // kx.css is read with ?raw by the motion-token test (CSS must mirror lib/motion)
    css: { include: [/kx.css/] },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
