# Design: Aba "Agenda" (cópia do Google Agenda)

**Data:** 2026-06-25
**Status:** Aprovado

---

## Contexto

O usuário pediu uma nova aba "Agenda" no sistemaMelo, inspirada visualmente no Google Agenda (print fornecido: visão semanal, mini-calendário lateral, lista de agendas com checkbox colorido, criação de evento), mas com o design/UI do próprio sistemaMelo (tema escuro, Tailwind, mesmo padrão visual das outras abas).

## Entendimento

- Agenda **compartilhada por toda a equipe** — qualquer usuário logado vê, cria, edita e exclui qualquer evento.
- Só **visão Semana** nesta v1 (sem mês/dia/lista).
- Evento simples: título + início + fim, no mesmo dia. Sem recorrência, dia inteiro, descrição, local ou convidados.
- Categorias coloridas **gerenciáveis pelo usuário** (criar/editar nome+cor), mesmo padrão de tags do CRM. Servem só pra organização visual — não são "agendas" por pessoa.
- Mini-calendário do mês na lateral, pra navegação rápida entre semanas.
- Sem busca de eventos nesta v1.
- Sem integração com `Task.dueDate` existente — totalmente desacoplado.
- Editar/mover evento: só por popup de clique (criar/editar/excluir). Sem arrastar-para-mover nem redimensionar.

## Assunções

- Performance/escala: time interno pequeno, poucas dezenas de eventos/semana — sem necessidade de otimização especial.
- Segurança: mesma autenticação (NextAuth) já usada em todas as rotas do sistema.
- Visibilidade de categoria (checkbox mostrar/esconder) é só estado local do cliente, não persiste no banco.
- Sem biblioteca de datas nova — cálculo com `Date` nativo, consistente com o resto do projeto.

---

## Modelo de Dados

```prisma
model EventCategory {
  id     String        @id @default(cuid())
  name   String
  color  String
  events AgendaEvent[]
}

model AgendaEvent {
  id         String         @id @default(cuid())
  title      String
  startsAt   DateTime
  endsAt     DateTime
  categoryId String?
  category   EventCategory? @relation(fields: [categoryId], references: [id], onDelete: SetNull)
  createdAt  DateTime       @default(now())
  updatedAt  DateTime       @updatedAt
}
```

- `categoryId` opcional — evento sem categoria é válido (cor neutra).
- Apagar categoria não apaga eventos, só desvincula (`onDelete: SetNull`).
- Nome `AgendaEvent` (não `Event`) pra evitar ambiguidade conceitual.

---

## Rotas de API

- `GET /api/agenda/events?start=ISO&end=ISO` — lista eventos cujo intervalo `[startsAt, endsAt]` cruza com `[start, end]` (a semana visível).
- `POST /api/agenda/events` — cria (`title`, `startsAt`, `endsAt`, `categoryId?`).
- `PUT /api/agenda/events/[id]` — atualiza (mesmos campos, parciais).
- `DELETE /api/agenda/events/[id]` — exclui.
- `GET /api/agenda/categories` — lista.
- `POST /api/agenda/categories` — cria (`name`, `color`).
- `PUT /api/agenda/categories/[id]` — atualiza.
- `DELETE /api/agenda/categories/[id]` — exclui (eventos vinculados ficam `categoryId: null`).

Todas exigem `getServerSession` (401 se não autenticado), mesmo padrão das rotas do CRM. Sem restrição de "dono" — qualquer usuário autenticado pode operar em qualquer evento/categoria.

**Validação no backend** (`POST`/`PUT` de eventos): `endsAt` deve ser depois de `startsAt`, e ambos devem cair no mesmo dia civil (`toDateString()` igual) — gera 400 com mensagem clara se violado.

---

## Componentes de Frontend

- **`src/app/page.tsx`**: nova aba "Agenda" (ícone `Calendar`), mesmo padrão das demais (botão com gradiente quando ativo).
- **`src/types/agenda.ts`**: tipos `AgendaEvent`, `EventCategory`.
- **`src/hooks/agenda-api.ts`**: hooks React Query — `useAgendaEvents(weekStart, weekEnd)`, `useCreateEvent`, `useUpdateEvent`, `useDeleteEvent`, `useEventCategories`, `useCreateCategory`, `useUpdateCategory`, `useDeleteCategory`. Mesmo padrão de `crm-api.ts`.
- **`src/components/agenda/agenda-view.tsx`** (orquestrador): estado `currentWeekStart: Date`; cabeçalho com "Hoje" + setas + label do intervalo (ex: "21 – 27 de Junho"); layout em duas colunas (sidebar fixa + grade flexível).
- **`src/components/agenda/mini-calendar.tsx`**: mini-calendário do mês corrente (ou do mês do `currentWeekStart`), com setas pra trocar de mês; clicar num dia chama `onSelectDate(date)` que recalcula `currentWeekStart` pra conter aquele dia.
- **`src/components/agenda/category-sidebar.tsx`**: lista `EventCategory[]` com checkbox colorido (estado local `Set<categoryId>` de categorias visíveis); botão "+" abre inline form (nome + color picker) reaproveitando o padrão visual já usado em `lead-info-tab.tsx` pra criar tag.
- **`src/components/agenda/week-grid.tsx`**: grade de 7 colunas × 24 linhas (horas 0–23, cada uma com altura fixa em px); cabeçalho de dia (nome curto + número, destaca o dia atual); eventos posicionados absolutamente (`top`/`height` calculados a partir de `startsAt`/`endsAt` em minutos × px-por-minuto); clique em espaço vazio chama `onCreateAt(date, hour)`; clique em evento chama `onEditEvent(event)`. Filtra por categorias visíveis (do `category-sidebar`).
- **`src/components/agenda/event-modal.tsx`**: modal (`@base-ui/react`, mesmo padrão já usado no projeto) com campos título, data, hora início, hora fim, select de categoria; botões Salvar / Excluir (só em modo edição) / Cancelar; mostra erro de validação inline se fim ≤ início.

---

## Casos de Borda

- **Eventos sobrepostos no mesmo dia**: agrupar eventos cujo intervalo de tempo se sobrepõe e dividir a largura da coluna igualmente entre eles, lado a lado (mesmo efeito visual do Google Agenda).
- **Evento muito curto**: altura mínima de exibição em pixels (ex: 24px), mesmo que a duração real seja menor.
- **Fim ≤ início, ou fim em outro dia civil**: rejeitado na validação do backend E no formulário do frontend (feedback imediato antes de chamar a API).
- **Categoria apagada**: eventos vinculados passam a `categoryId: null`, continuam existindo, exibidos com cor neutra.
- **Nenhuma categoria cadastrada**: seletor do modal mostra "Sem categoria" como opção padrão; grid funciona normalmente sem nenhum checkbox de categoria na sidebar.

---

## Decision Log

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| Agenda única compartilhada | Pessoal privada; híbrido pessoal+compartilhado | Usuário escolheu "compartilhada pra equipe toda" |
| Categorias gerenciáveis (criar/editar) | Fixas no código; sem categorias | Paridade com padrão de tags do CRM, já validado pelo usuário |
| Só visão Semana | Mês, Dia, Lista | Selecionado explicitamente; YAGNI pras demais |
| Evento simples (sem recorrência/dia inteiro/descrição/local/convidados) | Suporte completo tipo Google Agenda | Escopo reduzido explicitamente |
| UI customizada + `Date` nativo | `react-big-calendar`; UI customizada + `date-fns` | Escopo enxuto torna data nativa suficiente; zero dependência nova |
| Qualquer usuário edita/exclui qualquer evento | Restringir ao criador | Mesmo nível de confiança do Kanban/CRM existentes |
| Visibilidade de categoria só no cliente | Persistir preferência por usuário | Mais simples; sem conceito de preferência de usuário hoje |
| Clique abre popup; sem arrastar/redimensionar | Drag-and-drop com @dnd-kit (já usado no Kanban) | Selecionado explicitamente; reduz complexidade da v1 |
