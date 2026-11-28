import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  /*
   * Relative base: the build works at a root domain (Cloudflare Pages / Vercel) and under a
   * sub-path such as GitHub Pages' /One-Warm-Spot/ without rebuilding. Public files are
   * referenced through assetUrl() (src/game/engine/assetUrl.ts); the dev server still serves at '/'.
   */
  base: './',
  plugins: [react()],
})
