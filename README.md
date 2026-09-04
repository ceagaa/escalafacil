# Achados & Perdidos

App para gerenciar escala de voluntários, controlar itens perdidos e guardar volumes em congregações.

## O que faz

- **Escala de voluntários** — monta turnos pra sexta, sábado e domingo, designa quem fica em cada período
- **Achados e Perdidos** — registra itens com foto, acompanha se já foi entregue ou ainda tá guardado
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

Crie um arquivo `.env` na raiz:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua_chave_aqui
VITE_STORAGE_PASSPHRASE=uma_string_forte_e_aleatoria
```

Nunca commite o `.env`. O `.gitignore` já tá configurado pra isso.

## Deploy

O projeto tá pronto pra Cloudflare Pages. É só conectar o repositório GitHub no painel do Cloudflare e configurar as variáveis de ambiente lá.

Build: `vite build`
Saída: `dist/`
Deploy manual: `npm run deploy`

No Cloudflare Pages conectado ao GitHub, use `npm run build` como build command, `dist` como output directory e deixe o deploy command vazio: o Pages publica automaticamente o resultado do build. Não use `wrangler deploy`, que é o comando de Workers. O deploy command só deve usar `wrangler pages deploy` se você tiver um token com a permissão correta (ver erro 10000 abaixo).

Para deploy manual fora da integração Git, use `npm run deploy` com um `CLOUDFLARE_API_TOKEN` que tenha a permissão `Account > Cloudflare Pages > Edit` na conta correta.

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

## Testes

```bash
npm test
```

Usa Vitest com jsdom. 187 testes cobrindo services, componentes e fluxos de auth.

## Licença

Uso interno. Não distribuir.
