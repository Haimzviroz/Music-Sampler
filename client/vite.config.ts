import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Only pure state logic is unit tested. The audio engine needs a real
  // AudioContext, so there is nothing here for jsdom to provide.
  test: {
    environment: 'node',
  },
})
