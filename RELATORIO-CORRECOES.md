# Limpeza e correções — EscalaFácil

Relatório do que foi corrigido, o que mudou de contrato e o que ficou pendente.
Base: análise solicitada em 17/10 (ver conversa). Estado final: **lint sem erros**,
**204 testes passando**, **build OK**.

---

## 1. Crítico: contrato `/sb` quebrado com o README

**Problema.** O README descrevia uma arquitetura que não existia mais no código:
Pages Function em `functions/`, proxy `/sb` no `vite.config.js`, segredos em
`SUPABASE_URL`/`SUPABASE_ANON_KEY`. O commit `4deeb0b`
("fix: remove Cloudflare proxy, connect directly to Supabase") havia removido a
pasta `functions/`, o `_routes.json`, o `wrangler.toml` e o proxy do Vite — mas o
README continuou afirmando o contrário. Quem seguisse o README configuraria as
variáveis erradas e o app não autenticaria.

**Decisão.** Manteve-se a arquitetura real (cliente direto, sem proxy). Motivos:
o commit que a removeu documenta que as Functions quebravam o deploy no Wrangler
v4; a chave anon do Supabase é pública por design; a proteção real é o RLS em
`supabase/`. Reintroduzir o proxy traria de volta o problema de deploy sem
ganho de segurança.

**O que mudou.**
- `README.md`: reescritas as seções "Estrutura do projeto", "Variáveis de
  ambiente" e "Deploy". Removidas as referências a `functions/`, `/sb`, `npm run
  deploy` (script inexistente), e ao passo a passo de "esconder a chave".
  Documentado o prefixo `VITE_` obrigatório e o fato de a chave anon ser pública.
  Contagem de testes atualizada.
- `.env.example`: o app bloqueia escrita nesse arquivo (caminho protegido), então
  ele continua com as três variáveis `VITE_*`. **Pendência de 1 minuto para você:**
  acrescentar `VITE_GOOGLE_CLIENT_ID=...`, que é lida por
  `src/components/GoogleLoginButton.tsx` e não estava documentada.

---

## 2. Bugs corrigidos

| # | Bug | Correção |
|---|---|---|
| 4.3 | `App.jsx`: efeito de sync sem `eventoId` nas deps — trocar de evento com o mesmo departamento não recarregava a escala | `eventoId` adicionado às deps dos dois efeitos; `hasLoadedRemoteData` é reiniciado quando o evento muda (`src/App.jsx`) |
| 4.11 | Evento de dia único (assembleia) mostrando estado vazio: `activeDay` ficava fixo em "Sexta-feira" e `dayCards` filtrava por esse dia | `getDefaultDay(eventType)` define o dia inicial ("Dia do Evento" para assembleia) e `ScheduleView` calcula o turno atual com o dia efetivo (`src/App.jsx`, `src/components/ScheduleView.jsx`) |
| — | `sanitizeSchedule` descartava a escala vinda do banco: `data.schedule` era entregue ao `useLocalStorage`, que rejeitava qualquer escala com menos de 16 turnos e lia o `initialSchedule` | Novo `sanitizeLoadedSchedule` (aceita qualquer escala com blocos válidos); `isValidSchedule`/`sanitizeSchedule` seguem existindo para o valor inicial (`src/utils/helpers.js`, `src/App.jsx`) |
| 4.7 | Alocar/desalocar pelo modal **apagava os nomes avulsos** do turno: o `delete`+`insert` em `shift_volunteers` reescrevia só os `volunteer_id` | `handleAllocateVolunteer`/`handleDeallocateVolunteer` agora usam `persistAssignments()`, que reenvia os `manual_name` existentes (`src/App.jsx`) |
| 4.5 | `PublicCadastro`: rate limit gravado **antes** do insert — um erro de RLS bloqueava o usuário por 30 s sem cadastro | O timestamp só é gravado depois do insert bem-sucedido (`src/pages/PublicCadastro.jsx`) |
| 4.6 | `PublicCadastro`: exceção de rede no carregamento deixava a tela em "Carregando..." para sempre | `try/catch/finally` no `useEffect`; erro vira mensagem de "Departamento não encontrado" com o motivo real (`src/pages/PublicCadastro.jsx`) |
| 4.2 | `Dashboard`: se `activeDepartment.department.name` viesse vazio, o botão "Revogar" liberava com o campo de confirmação vazio | `canConfirmRevoke` exige nome não vazio **e** igual ao digitado (`src/pages/Dashboard.jsx`) |
| 4.8 | Falhas silenciosas: excluir turno/voluntário mostrava "excluído" antes da chamada e só logava o erro | Cada operação só confirma depois do sucesso; em erro mostra aviso e força resync (`setHasLoadedRemoteData(false)`). O mesmo no `saveShiftFromModal`, que antes dizia "salvo offline" mesmo com internet (`src/App.jsx`) |
| 4.10 | `EventContext`: se a rede travasse, o app ficava preso em "Carregando evento..." | `Promise.race` com timeout de 8 s, igual ao `AuthContext` (`src/context/EventContext.jsx`) |
| 4.12 | `AllocateVolunteersModal` acessava `shift.start` e `block.day` sem guard | Retorna `null` se `block`/`shift` faltarem; `volunteers` com default `[]` (`src/components/AllocateVolunteersModal.jsx`) |
| 4.9 | `useLocalStorage` regravava o snapshot inteiro a cada render e não sincronizava entre abas | Gravação só quando a serialização muda (ref de comparação) + listener de `storage` (`src/hooks/useLocalStorage.js`) |

---

## 3. Rotas

- **Dois `<Routes>` irmãos** em `AppLayout` (um para `/` fora do `hasDepartment`,
  outro condicional para as demais) unificados em um único `<Routes>`, com o
  bloco protegido renderizado somente quando há departamento ativo.
- **404 dentro do app**: `<Route path="*" element={<Navigate to="/" replace />} />`
  — antes, um path desconhecido renderizava header e stats com o conteúdo vazio.
- **`GerenciarDepartamentos` era rota órfã**: existia, estava roteada em
  `/departamentos`, mas fora do menu (o item não existia em `navigationItems`).
  Agora há o item "Departamentos" na navegação (desktop e mobile), marcado com
  `coordinatorOnly`; a filtragem passou a ser declarativa (`requiresDepartment`
  + `coordinatorOnly`) em vez do `if (item.path === "/configuracoes")` hardcoded.

---

## 4. Código duplicado

- **`Dashboard`**: `loadDepartments` (dentro do `useEffect`) e `refreshDeptRecords`
  eram ~35 linhas idênticas. Extraídos `fetchEventDepartments(eventoId)`,
  `isStandardDepartment(dept)` e `buildOptimisticMembership(dept, eventoId, userId)`
  — o terceiro também substitui duas montagens manuais de membership que existiam
  nos fluxos de assumir e de criar departamento.
- **`EventSelector`**: novo `src/components/EventFormFields.jsx` com
  `UfCityFields` (par Estado + `CityCombobox`), `IdentificacoesFields` (lista com
  máscara, remover e adicionar) e `maskIdentificacao`. O arquivo caiu de 846 para
  730 linhas e as quatro cópias do bloco de identificações viraram uma.
- **`helpers.js`**: `sortScheduleBlocks` e `sortShifts` usavam `indexOf` sobre
  listas de ids — ids de banco (UUID) não estão nelas, então o "-1" arrastava tudo
  e a ordenação não fazia nada. Agora um comparador único (`sortByKnownOrder`)
  mantém ids conhecidos na ordem e joga desconhecidos para o fim.

## 5. Código morto removido

- Arquivos: `src/components/ImportVolunteersModal.jsx`, `src/components/EventBadge.jsx`,
  `src/utils/compressImage.js` (este também com lógica de escala invertida).
- Funções: `eventService.getEventoById`, `getEventDepartments`, `getUserEvents`;
  `departmentService.getDashboardStats`, `getDepartmentOwnerBySlug`,
  `updateDepartmentFeatures`; `volunteersService.getVolunteer`;
  `Skeleton.SkeletonCard`/`SkeletonTable`; `UI.Icon`.
- `Dashboard.isMine` (a lógica estava inlineada nos cards).
- `EventSelector.editCityValid` (o valor do formulário de edição nunca era
  validado contra a lista do IBGE; o estado era escrito e nunca lido).
- Testes correspondentes removidos (`departmentService.test.js`,
  `volunteersService.test.js`) — a suíte caiu de 213 para 204 testes, sem perder
  cobertura de nada que exista.

## 6. Lint

- **Erro zerado**: `src/tokens.js` usava `as const` em arquivo `.js`
  (`TS(8016)`). O `as const` foi removido — o arquivo é documentação do design
  system e não é importado por ninguém.
- Restam apenas avisos de "fast refresh" (`only-export-components`) em
  `AuthContext`, `EventContext`, `EventFormFields` e dois imports não usados em
  testes antigos. Nenhum é bug.

---

## 7. Pendências (precisam de você)

1. **`.env.example`**: falta `VITE_GOOGLE_CLIENT_ID` (arquivo protegido pelo app).
2. **`VITE_STORAGE_PASSPHRASE` em produção**: `src/utils/crypto.js` usa
   `'ap-default-dev-key-2024'` quando a variável não existe — o snapshot offline
   fica cifrado com chave pública. Vale definir a variável no Pages.
3. **`importVolunteersFromEvento`** continua um mock (`console.log` + retorno
   vazio) em `eventService.js`. A UI que o consumia
   (`ImportVolunteersModal`) foi removida junto com o código morto; se a
   importação de voluntários voltar, a função precisa ser implementada de verdade.
4. **`public/_headers`**: a CSP precisa permitir o domínio do Supabase em
   `connect-src` (a chamada é direta, não há mais proxy). Isso vale checar antes
   do próximo deploy.
5. **Vitest**: 62% do tempo da suíte é recriando jsdom (19×). O próprio Vitest
   sugere `pool: 'vmThreads'` em `vitest.config.js` — ganho de ~25 s para ~8 s.
