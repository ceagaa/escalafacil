# EscalaFácil

App para gerenciar escala de voluntários dos departamentos.

## O que faz

- **Escala de voluntários** — monta turnos pra sexta, sábado e domingo, designa quem fica em cada período
- **Voluntários** — cadastra, aprova e organiza a equipe por departamento
- **Dashboard** — visão geral com stats do dia
- **PWA** — funciona offline e pode ser instalado no celular como app

## Tecnologias

- React 18 + Vite
- Tailwind CSS
- Supabase (banco, autenticação, storage)
- Service Worker via Workbox (PWA)

## Como rodar

```bash
# instala as dependências
npm install

# sobe o servidor de desenvolvimento
npm run dev

# build de produção
npm run build

# roda os testes
npm test

# lint
npm run lint
```

## Estrutura do projeto

```
src/
  components/   → componentes reutilizáveis (UI, modais, etc.)
  pages/        → páginas do app (Login, Dashboard, Escala, etc.)
  services/     → camada de comunicação com o Supabase
  context/      → contexto de autenticação
  hooks/        → hooks customizados
  utils/        → funções auxiliares
  __tests__/    → testes
supabase/       → scripts SQL do banco (RLS, funções)
public/         → assets estáticos e config do Cloudflare Pages
```

## Variáveis de ambiente

O app fala **direto** com o Supabase pelo cliente `@supabase/supabase-js`; não existe mais proxy `/sb` (a Pages Function foi removida — ver histórico). A URL e a chave **anon** do Supabase entram no bundle do cliente, e isso é esperado: a chave anon é pública por design e quem protege os dados é o **RLS** no banco. Nunca use a chave `service_role` aqui.

Crie um arquivo `.env` na raiz para desenvolvimento local:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_anon_aqui
VITE_STORAGE_PASSPHRASE=uma_string_forte_e_aleatoria
```

O prefixo `VITE_` é obrigatório nessas variáveis: é o que o Vite expõe ao cliente via `import.meta.env`. Sem o prefixo, `src/services/supabase.js` recebe `undefined` e o app não autentica.

Nunca commite o `.env`. O `.gitignore` já tá configurado pra isso.

## Deploy

O projeto tá pronto pra Cloudflare Pages. Build: `npm run build`. Saída: `dist/`.

Não existe pasta `functions/` nem `_routes.json`: o deploy é só o conteúdo de `dist/`, sem Function nenhuma.

### Passo a passo no Cloudflare

1. Abra [dash.cloudflare.com](https://dash.cloudflare.com) e entre no **Workers & Pages**.
2. Abra o projeto **escalafacil** (Pages).
3. Vá em **Settings** → **Variables and Secrets** (ou **Environment variables**).
4. Em **Production** (e depois em **Preview**, se usar preview):
   - **Add** → `VITE_SUPABASE_URL` → valor `https://xxxxx.supabase.co` (Supabase → Settings → API → Project URL).
   - **Add** → `VITE_SUPABASE_ANON_KEY` → valor da chave **anon public** (Supabase → Settings → API).
5. Confirme o build:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** vazio (raiz do repo)
   - Deploy command vazio na integração Git. Não use `wrangler deploy` (isso é Workers).
6. **Save** e faça um deploy novo: **Deployments** → **Retry deployment**, ou um push no Git.
7. Depois do deploy, abra o site → F12 → **Network** → login. A chamada vai para `https://seu-projeto.supabase.co/auth/v1/...`. Se ela falhar com 401/403, o problema está no RLS ou na chave, não em rota.
8. No Supabase → **Authentication** → **URL Configuration**, mantenha o domínio do Pages em **Site URL** e **Redirect URLs** (ex.: `https://seu-projeto.pages.dev/**`). O reset de senha e o login com Google continuam no mesmo origin.

A segurança dos dados depende inteiramente das políticas de RLS em `supabase/`.

No Cloudflare Pages conectado ao GitHub, use `npm run build` como build command, `dist` como output directory e deixe o deploy command vazio: o Pages publica automaticamente o resultado do build. Não use `wrangler deploy`, que é o comando de Workers. (O projeto **não** tem script `npm run deploy`; se você quiser deploy manual por CLI, use `npx wrangler pages deploy dist` com um token que tenha a permissão correta — ver erro 10000 abaixo.)

### Erro 10000 no deploy (Authentication error)

Se o deploy falhar com:

```
✘ [ERROR] A request to the Cloudflare API (.../pages/projects/escalafacil) failed.
  Authentication error [code: 10000]
```

é porque o `CLOUDFLARE_API_TOKEN` configurado no projeto não tem a permissão `Cloudflare Pages: Edit`. Um "User API Token" com escopo só de usuário consegue autenticar, mas não tem acesso ao projeto Pages, e o wrangler falha na chamada da API.

Pra corrigir (o dashboard não deixa salvar o deploy command vazio, então use a opção 2):

1. **Corrigir o token** (recomendado): crie um token novo em https://dash.cloudflare.com/profile/api-tokens:
   - Create Token > Create custom token (ou o template de Pages)
   - Permissions: `Account > Cloudflare Pages > Edit`
   - Account Resources: `Include > Specific account` > a conta `Sswebtechcontato@gmail.com's Account` (`6e04823d080a758e7acea0a837746b01`)
   - Continue > Create Token e copie o valor (ele só aparece uma vez)
   - No projeto Pages: Settings > Environment variables, atualize a variável `CLOUDFLARE_API_TOKEN` (Production e Preview) com o token novo e rode o deploy de novo (Retry deployment)
2. **Remover o deploy command** (se o painel permitir): em Settings > Builds & deployments do projeto Pages, deixe o deploy command vazio. O Pages publica o `dist` automaticamente depois do build, sem precisar de token.

## Banco de dados

Os scripts SQL ficam em `supabase/`. Não são commitados por segurança (contêm schema e políticas de acesso). Roda eles direto no SQL Editor do Supabase Dashboard.

Para habilitar a exclusão de eventos por coordenadores, aplique a política de DELETE atualizada em `supabase/event_lifecycle.sql` (seção 4) ou `supabase/migration_eventos_complete.sql` (seção 4). Ela permite excluir ao criador ou a um coordenador vinculado ao mesmo evento; a edição continua restrita ao criador.

## Testes

```bash
npm test
```

Usa Vitest com jsdom. 213 testes cobrindo services, componentes e fluxos de auth.

## Licença

Uso interno. Não distribuir.
