import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const supabaseUrl = env.VITE_SUPABASE_URL || ''

  return {
    base: './',
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'Achados & Perdidos - Guarda Volumes',
          short_name: 'Achados',
          description: 'App para gerenciamento de escala, voluntários e itens perdidos.',
          theme_color: '#172233',
          background_color: '#f6f6f6',
          display: 'standalone',
          start_url: '.',
          scope: '.',
          lang: 'pt-BR',
          orientation: 'portrait-primary',
          icons: [
            {
              src: 'favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
            {
              src: 'favicon.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'favicon.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,json}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/cdn-uicons\.flaticon\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'flaticon-uicons',
                expiration: { maxEntries: 50, maxAgeSeconds: 86400 * 30 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 20, maxAgeSeconds: 86400 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            ...(supabaseUrl
              ? [
                  {
                    urlPattern: new RegExp('^' + supabaseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '/.*'),
                    handler: 'NetworkFirst',
                    options: {
                      cacheName: 'supabase-api',
                      expiration: { maxEntries: 50, maxAgeSeconds: 86400 * 7 },
                      networkTimeoutSeconds: 10,
                      cacheableResponse: { statuses: [0, 200] },
                    },
                  },
                ]
              : []),
          ],
        },
      }),
    ],
  }
})
