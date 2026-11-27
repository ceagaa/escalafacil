import { defineConfig, loadEnv, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Porta da API local: VITE_API_PORT (ambiente ou `.env`) > padrão.
// É o mesmo valor lido por scripts/dev-api.mjs, que sobe o `wrangler dev`
// nessa porta — assim wrangler e proxy nunca ficam dessincronizados.
const DEFAULT_API_PORT = 8787

function readApiPort(raw: string | undefined): number {
  const port = Number(raw ?? DEFAULT_API_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`VITE_API_PORT inválido: "${raw}". Use um número de porta válido (ex.: 8787).`)
  }
  return port
}

// Proxy /api e /auth para o Worker local (npm run dev / npm run dev:api).
// Se o Worker estiver no ar, devolve erro amigável em vez de "502 Bad Gateway".
function createApiProxy(apiPort: number): ProxyOptions {
  const target = `http://localhost:${apiPort}`
  return {
    target,
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
                `Worker local (porta ${apiPort}) não está rodando. Execute "npm run dev" (sobe API + web juntas) ou "npm run dev:api" em outro terminal.`,
            }),
          );
        }
      });
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = readApiPort(process.env.VITE_API_PORT ?? env.VITE_API_PORT)
  const apiProxy = createApiProxy(apiPort)
  const apiTarget = `http://localhost:${apiPort}`
  return {
    // Base ABSOLUTA: as rotas públicas são aninhadas (/:slug/cadastro e
    // /:slug/escala). Com base relativa ('./') o navegador resolveria
    // ./assets/... contra a rota atual (ex.: /minha-rota/assets/...), o
    // fallback do SPA devolveria index.html e tudo quebraria com erro de
    // MIME type ("Failed to load module script ... text/html").
    base: '/',
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
        '/api': apiTarget,
        '/auth': apiTarget,
      },
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'favicon.svg',
          'favicon-32x32.png',
          'apple-touch-icon.png',
          'android-chrome-192x192.png',
          'android-chrome-512x512.png',
        ],
        manifest: {
          name: 'EscalaFácil',
          short_name: 'EscalaFácil',
          description: 'Gerenciamento de escalas, voluntários e departamentos para eventos sazonais.',
          theme_color: '#172233',
          background_color: '#f6f6f6',
          display: 'standalone',
          start_url: '/',
          scope: '/',
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
              src: 'android-chrome-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
            {
              src: 'android-chrome-192x192.png',
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
