# EscalaFácil

App para gerenciar escala de voluntários dos departamentos.

## O que faz

- **Escala de voluntários** — monta turnos pra sexta, sábado e domingo, designa quem fica em cada período
- **Voluntários** — cadastra, aprova e organiza a equipe por departamento
- **Dashboard** — visão geral com stats do dia
- **Aparência** — tema automático conforme o dispositivo, com opções clara e escura
- **PWA** — funciona offline e pode ser instalado no celular como app

## Tecnologias

- React 18 + Vite
- Tailwind CSS
- Cloudflare Workers + D1 (API, banco e autenticação próprios — sem Supabase)
- Service Worker via Workbox (PWA)

## Como rodar

```bash
# instala as dependências
npm install

# sobe a API (Worker local, porta 8787) + a web (Vite, porta 5173) juntas
npm run dev

# só a web (se a API já estiver rodando em outro terminal)
npm run dev:web

# só a API (Worker local na porta 8787)
npm run dev:api

# build de produção
npm run build

# roda os testes
npm test

# lint
npm run lint
```

O Vite faz proxy de `/api` e `/auth` para `http://localhost:8787`. Se o Worker local não estiver no ar, a resposta é um `503` com instrução (em vez de um `502` confuso).

### Primeira vez na máquina

1. **Secrets locais** — crie o arquivo `.dev.vars` na raiz (é ignorado pelo Git):

   ```
   JWT_SECRET=uma_string_longa_e_aleatoria
   GOOGLE_CLIENT_ID=seu-client-id-do-google-cloud
   ```

2. **Banco local** — aplique as migrations no D1 local:

   ```bash
   npx wrangler d1 migrations apply escalafacil-db
   ```

Depois disso, `npm run dev` sobe tudo.

## Estrutura do projeto

```
src/
  components/   → componentes reutilizáveis (UI, modais, etc.)
  pages/        → páginas do app (Login, Dashboard, Escala, etc.)
  services/     → camada de comunicação com a API
  context/      → contexto de autenticação e tema
  hooks/        → hooks customizados
  utils/        → funções auxiliares
  __tests__/    → testes
worker/
  src/          → API (Cloudflare Worker): auth + rotas
  migrations/   → schema do D1 (SQL canônico)
supabase/       → legado da migração Supabase → D1 (sem uso)
public/         → assets estáticos, _headers e manifest do PWA
```

## Variáveis de ambiente

### Front — `.env` (prefixo `VITE_` obrigatório)

| Variável | Para que serve |
|---|---|
| `VITE_STORAGE_PASSPHRASE` | Criptografia local de arquivos no navegador |
| `VITE_GOOGLE_CLIENT_ID` | Login com Google (mesmo valor usado no Worker) |

O prefixo `VITE_` é o que o Vite expõe ao cliente via `import.meta.env`; sem ele, a variável chega como `undefined`.

### Worker

Em produção os valores são **secrets** do Worker:

```bash
npx wrangler secret put JWT_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
```

Em desenvolvimento local eles vêm do `.dev.vars` (ver "Primeira vez na máquina").

Nunca commite `.env` nem `.dev.vars` — o `.gitignore` já cobre os dois.

## Deploy

O Worker único serve a **API** e a **SPA** (Static Assets) no mesmo domínio:

```bash
npm run build
npx wrangler deploy
```

- Produção: `https://escalafacil-api.sswebtechcontato.workers.dev`
- Banco de produção (uma vez por mudança de schema):

  ```bash
  npx wrangler d1 migrations apply escalafacil-db --remote
  ```

## Banco de dados

Cloudflare D1 (SQLite). O schema canônico está em `worker/migrations/*.sql`:

```bash
# local (usado pelo npm run dev)
npx wrangler d1 migrations apply escalafacil-db

# produção
npx wrangler d1 migrations apply escalafacil-db --remote
```

O banco está **zerado por decisão** — a migração de dados antigos do Supabase foi descartada; os scripts em `supabase/` são apenas legado.

## Testes

```bash
npm test
```

Usa Vitest com jsdom. 231 testes cobrindo services, componentes e fluxos de auth.

## Licença

Uso interno. Não distribuir.
