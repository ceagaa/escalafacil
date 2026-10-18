# Correção do fluxo de departamentos — etapas 1-3

Resolve os dois bugs relatados: **card mostrando "Disponível" num departamento já
assumido** (tanto para o próprio coordenador quanto para outras contas) e o
retorno ao painel ao voltar para o mesmo evento.

---

## A causa raiz (uma só para os dois sintomas)

O coordenador de um departamento era lido de **duas fontes que discordam**:

| Fonte | O que grava | Quando é escrita |
|---|---|---|
| `department_members` (evento + department + user + role) | o claim event-scoped | **sempre** que alguém assume (`claimDepartmentForEvento`) |
| `departments.coordenador_id` (coluna legada) | o coordenador do departamento | **nunca** no fluxo novo — o próprio código diz *"The departments table is left untouched"* |

O card lia a fonte errada (a legada), então mostrava "Disponível" para qualquer
departamento assumido pelo fluxo atual. E o `AuthContext` filtrava a membership
por `user_id`, então o Dashboard não conseguia reconhecer o próprio departamento
enquanto a lista do usuário ainda estava carregando.

---

## O que mudou

### 1. O coordenador agora vem de `department_members` (fonte de verdade)

`applyEventOwner` passou a **priorizar a membership do evento** e só usar
`departments.coordenador_id` como fallback (departamentos legados, sem
membership). Além disso, a busca dos donos deixou de cair para `evento_id IS
NULL` quando existe evento ativo — isso podia casar um coordenador de outro
evento.

**Efeito:** o card de um departamento assumido mostra "Em uso" + **"Coordenador:
Ana Souza."** para qualquer outra conta, e "Coordenando" para quem assumiu.

### 2. Auto-restore do departamento ativo, derivado do banco

Ao carregar os departamentos do evento, o Dashboard verifica se o usuário
coordena algum deles:

- **exatamente um** → entra direto no painel (que é o comportamento correto ao
  voltar para o mesmo evento pelo "Trocar evento");
- **mais de um** → fica na tela de escolha, para o usuário decidir;
- **nenhum** → tela de escolha normal.

### 3. `departments` deixa de ser apagado na troca de evento

O `AuthContext` tinha um efeito que zerava `departments` e `activeDepartment`
quando não havia evento. Como a troca de evento é assíncrona, o Dashboard
renderizava a tela de cards com a lista de memberships ainda vazia — era a
janela exata em que o próprio departamento aparecia como disponível. Agora o
array sobrevive à troca (e a membership do evento tem prioridade sobre vínculos
legados, sem duplicar o mesmo departamento).

---

## Refatoração de apoio

- Novas funções exportadas de `src/services/dashboardDepartments.js`:
  `fetchEventDepartments`, `fetchOwnersMap`, `applyEventOwner`,
  `groupDepartments`, `ownerLabel`. Saíram de dentro do `Dashboard.jsx` para
  poderem ser mockadas nos testes de página.
- `src/__tests__/Dashboard.test.jsx` reescrito: 15 testes, incluindo os casos que
  reproduzem os dois bugs relatados (card inerte para departamento de outro,
  entrada direta no próprio, auto-restore com 1 departamento e ausência de
  auto-restore com 2).

## Validação

```
npm run lint   → 0 erros
npm test       → 204 testes passando (19 arquivos)
npm run build  → OK
```

Para ver no navegador: `npm run dev` (o app está no ar agora em
**http://localhost:5173/**).
