import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Proxy /api e /auth para o Worker local (npm run dev:api / npm run dev:all).
// Se o Worker estiver no ar, devolve erro amigável em vez de "502 Bad Gateway".
const apiProxy: ProxyOptions = {
  target: 'http://localhost:8787',
  configure(proxy) {
    // http-proxy expõe o evento 'error' (o tipo do Vite não declara .on).
    type ProxyWithError = {
      on(event: string, listener: (err: Error, req: unknown, res: unknown) => void): void;
    };
    type ErrorResponder = {
      headersSent?: boolean;
      writeHead(status: number, headers: Record<string, string>): void;
      end(body: string): void;
    };
    (proxy as unknown as ProxyWithError).on('error', (_err, _req, res) => {
      const response = res as ErrorResponder | undefined;
      if (response && typeof response.writeHead === 'function' && !response.headersSent) {
        response.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
        response.end(
          JSON.stringify({
            error:
              'Worker local (porta 8787) não está rodando. Execute "npm run dev" (sobe API + web juntas) ou "npm run dev:api" em outro terminal.',
          }),
        );
      }
    });
  },
}

export default defineConfig(() => {
  return {
    base: './',
    // Dev: /api e /auth são repassados ao Worker local (npx wrangler dev).
    // Em produção o Worker serve o SPA e a API no mesmo domínio.
    server: {
      proxy: {
        '/api': apiProxy,
        '/auth': apiProxy,
      },
    },
    preview: {
      proxy: {
        '/api': 'http://localhost:8787',
        '/auth': 'http://localhost:8787',
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'EscalaFácil',
          short_name: 'EscalaFácil',
          description: 'Gerenciamento de escalas, voluntários e departamentos para eventos sazonais.',
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
          ],
        },
      }),
    ],
  }
})
