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

No Cloudflare Pages, use `npm run build` como build command e `npx wrangler pages deploy dist --project-name escalafacil` como deploy command. Não use `wrangler deploy`, que é o comando de Workers e pode interpretar o `_redirects` incorretamente.

## Banco de dados

Os scripts SQL ficam em `supabase/`. Não são commitados por segurança (contêm schema e políticas de acesso). Roda eles direto no SQL Editor do Supabase Dashboard.

## Testes

```bash
npm test
```

Usa Vitest com jsdom. 187 testes cobrindo services, componentes e fluxos de auth.

## Licença

Uso interno. Não distribuir.
