import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Preview builds (deploy-preview.yml) are served from /mayaTrack/preview/<branch>/,
// which sits *inside* the production service worker's /mayaTrack/ scope. Shipping a
// second SW there makes cache behaviour impossible to reason about — and an
// installable "MayaTrack" that is really a feature branch is its own trap — so
// previews ship no service worker and no manifest at all.
const isPreview = process.env.PREVIEW_BUILD === '1'

const pwa = VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
  manifest: {
    name: 'MayaTrack - מעקב תינוק למשפחה',
    short_name: 'MayaTrack',
    description: 'מעקב האכלות, חיתולים ושאיבות לתינוק',
    lang: 'he',
    dir: 'rtl',
    theme_color: '#7c5cbf',
    background_color: '#1a1a2e',
    display: 'standalone',
    scope: '/mayaTrack/',
    start_url: '/mayaTrack/',
    icons: [
      {
        src: 'pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: 'pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  },
})

export default defineConfig({
  plugins: [react(), ...(isPreview ? [] : [pwa])],
  base: '/mayaTrack/',
})
