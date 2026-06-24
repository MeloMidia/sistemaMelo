# Design: Aba "Info" no Painel do Lead (CRM)

**Data:** 2026-06-24
**Status:** Aprovado

---

## Contexto

O painel lateral do lead (`src/components/crm/lead-panel.tsx`), entregue na integração CRM+WhatsApp, hoje mostra tudo em uma view única: nome/telefone no topo, responsável, tags, e o chat completo abaixo. O usuário pediu uma estrutura mais próxima do Kommo CRM (referência visual enviada): um cabeçalho com avatar, e duas visões separadas — uma de "informações" do lead (Pipeline, Estágio, Contato, Valor, Dono, Touchpoints, Tags) e outra só de conversa.

Também foi identificado que `Lead.name` nunca é preenchido hoje — o webhook só salva `phone`. O WhatsApp envia o nome de exibição do contato (`pushName`) em cada mensagem; esse design captura isso na criação do lead.

---

## Decisões de Escopo

Avaliado o print de referência (Kommo) campo a campo:

- **Incluído**: avatar, nome do lead (capturado do WhatsApp), data de criação, badge de etapa, Pipeline (texto fixo — só existe um funil), Contato (nome+telefone+copiar), Valor (R$, editável), Dono (responsável, já existia), Touchpoints (contador de mensagens), Tags (já existia).
- **Fora do escopo** (decidido explicitamente): MQL/SQL (qualificação), Fechamento (data de fechamento do negócio), múltiplos pipelines, abas de Notas/Histórico/Arquivos.

---

## Modelo de Dados

```prisma
model Lead {
  // ...campos existentes...
  value Float?   // "Valor" do negócio em R$, opcional, sem default
}
```

**Captura do nome** (`src/app/api/whatsapp/webhook/route.ts`, `handleMessagesUpsert`): ao criar um lead novo, extrai `data.pushName` do payload (se for string) e salva em `Lead.name`. Só acontece na criação — mensagens seguintes do mesmo lead não atualizam o nome (evita sobrescrever edição manual feita no CRM).

**Touchpoints**: não é campo no banco — é `_count: { select: { messages: true } }` no `include` das queries que já buscam o lead (`GET /api/crm/stages`, `GET /api/crm/leads/[id]`).

---

## Rotas de API (alterações)

- `PUT /api/crm/leads/[id]`: aceita `value` no corpo, mesmo padrão de update parcial já usado (`...(value !== undefined && { value })`). Mantém o tratamento de erro P2025/P2003 já existente.
- `GET /api/crm/stages` e `GET /api/crm/leads/[id]`: adicionam `_count: { select: { messages: true } }` no include.
- `src/types/crm.ts`: `Lead` ganha `value: number | null` e `_count: { messages: number }`.
- `src/hooks/crm-api.ts`: `useUpdateLead` aceita `value?: number | null` no input.

---

## Componentes (UI)

Reestruturação de `src/components/crm/lead-panel.tsx`:

- **`lead-panel.tsx`** (casca): header (avatar com inicial + nome + telefone + botão fechar) e barra de 2 abas (Info / Conversa) via `useState<'info' | 'conversa'>('info')`.
- **`lead-info-tab.tsx`** (novo): linhas de informação — Criado em, Pipeline (fixo), Estágio (badge, só leitura), Contato (nome+telefone+copiar), Valor (input numérico inline, prefixo "R$"), Dono (select de responsável, realocado daqui de cima), Touchpoints (`lead._count.messages`), Tags (chips + fluxo de criar/anexar, realocado).
- **`lead-conversa-tab.tsx`** (novo): só o chat — lista de mensagens com auto-scroll + composer, extraído do `lead-panel.tsx` atual sem mudanças de lógica.

Avatar: círculo colorido com a inicial do nome (ou primeiro dígito do telefone se não tiver nome), reaproveitando a lógica de hash de cor já usada em `kanban-column.tsx`.

Mudar de etapa continua só via drag-and-drop no board — a aba Info mostra o badge mas não tem seletor de etapa, pra não duplicar essa ação.

---

## Casos de Borda

- `pushName` ausente/vazio → `name` continua `null`, mostra telefone (comportamento atual preservado).
- Leads já existentes não são migrados/backfilled — continuam com `name: null` para sempre, já que o nome só é setado na criação do lead. Isso é aceito (leads antigos sem nome ficam assim, só os novos a partir de agora pegam o nome).
- Campo Valor vazio envia `null` (limpa o valor); aceita só números (`type="number"`, `min="0"`, `step="0.01"`), sem formatação de moeda completa (sem máscara R$ 1.234,56 — só prefixo visual "R$" antes do número puro).
- Copiar telefone: `navigator.clipboard.writeText`, feedback visual local (ícone vira check por ~1s), sem toast/lib nova.

---

## Decision Log

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| Abas via `useState` local (Opção A) | Tabs do shadcn/Radix; abas via URL | Mesmo padrão já usado em `page.tsx`; evita misturar bibliotecas de UI (`@base-ui/react` vs Radix) |
| MQL/SQL fora do escopo | Status único; dois toggles independentes | Usuário reverteu o pedido inicial — não é necessário agora |
| Nome só na criação, nunca atualizado | Atualizar sempre com o pushName mais recente | Evita sobrescrever edição manual feita por um SDR no CRM |
| Touchpoints via `_count`, sem campo no banco | Campo `touchpoints` incrementado manualmente | Mais simples, sempre consistente com o histórico real de mensagens |
| Valor sem máscara de moeda completa | Input mascarado com formatação R$ 1.234,56 | YAGNI — input numérico simples já resolve o pedido, formatação visual fica de follow-up se precisar |
