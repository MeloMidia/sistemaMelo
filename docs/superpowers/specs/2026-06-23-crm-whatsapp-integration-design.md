# Design: CRM com Inbox de WhatsApp no SistemaMelo

**Data:** 2026-06-23
**Status:** Aprovado

---

## Contexto

O sistemaMelo hoje tem Kanban de Processos, Mentoria, Tarefas e Dashboard de métricas (incluindo um contador manual `leadsWhatsapp` em `SdrDailyLog`), mas não tem cadastro de lead/contato, histórico de conversa nem pipeline de vendas real.

O objetivo é uma nova aba "CRM": um Kanban de leads onde cada card representa um contato de WhatsApp. Ao clicar no card, abre um painel lateral com dados do lead, tags coloridas e a conversa completa do WhatsApp embutida (enviar/receber sem sair da tela). Referência visual: Kommo CRM.

É para uso interno da própria Melo Mídia (vários SDRs, um número de WhatsApp compartilhado) — não é multi-tenant para os clientes da agência.

---

## Decisão de Conectividade: Evolution API

Avaliadas três opções: Meta Cloud API (oficial), BSP terceirizado (Twilio/Z-API), e solução não-oficial self-hosted (Evolution API/Baileys).

**Escolhida: Evolution API**, self-hosted, separada do sistemaMelo (infra própria, ainda a ser provisionada — fora do escopo deste documento).

- **Risco aceito explicitamente:** por simular o protocolo do WhatsApp Web, há risco real de banimento do número, especialmente em volume médio/alto (estimado em centenas de mensagens/dia). Mitigação no código: rate limit simples no endpoint de envio. Mitigação operacional (fora do código): número dedicado (não pessoal), aquecimento gradual.
- **Vantagem sobre Meta Cloud API:** sem necessidade de verificação de Meta Business Manager, sem restrição de janela de 24h/templates aprovados para reabrir conversa.

---

## Arquitetura

```
Evolution API (servidor próprio, a provisionar)
        │ webhook (POST) — evento messages.upsert / connection.update
        ▼
/api/whatsapp/webhook  ──► upsert Lead (telefone novo → 1ª LeadStage)
        │                  ──► grava Message (idempotente por whatsappMessageId)
        │                  ──► atualiza WhatsappConnection (se connection.update)
        │                  ──► emite evento SSE
        ▼
   PostgreSQL (Prisma)
        ▲
        │
/api/crm/leads, /api/crm/leads/[id]/messages, /api/crm/tags, /api/crm/stages
        ▲
        │ fetch / SSE
        │
  Nova aba "CRM" (src/components/crm/)
   ├─ KanbanLeads (colunas = LeadStage, dnd-kit — mesmo padrão do kanban/ existente)
   └─ LeadPanel (dados do lead + tags + chat embutido)
        │ envio de mensagem
        ▼
/api/whatsapp/send ──► POST {EVOLUTION_API_URL}/message/sendText/{instance}
                        (header apikey) ──► grava Message (OUTBOUND)
```

Integração segue o mesmo padrão de proxy já usado em `src/lib/automacao-proxy.ts` (URL + API key em env var, `if (!res.ok) throw`).

Tempo real via SSE (`/api/crm/stream`), mesmo padrão de `/api/automacao/stream/[jobId]`: uma conexão por sessão de SDR logado, recebe eventos de nova mensagem / status de conexão.

---

## Modelo de Dados (Prisma)

```prisma
model Lead {
  id           String     @id @default(cuid())
  name         String?
  phone        String     @unique          // E.164, normalizado na entrada e saída
  stageId      String
  stage        LeadStage  @relation(fields: [stageId], references: [id])
  assignedToId String?
  assignedTo   User?      @relation(fields: [assignedToId], references: [id])
  messages     Message[]
  tags         LeadTag[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}

model LeadStage {
  id    String @id @default(cuid())
  name  String
  order Int
  color String?
  leads Lead[]
}

model Message {
  id                String           @id @default(cuid())
  leadId            String
  lead              Lead             @relation(fields: [leadId], references: [id])
  whatsappMessageId String           @unique
  direction         MessageDirection
  content           String
  status            MessageStatus?
  createdAt         DateTime         @default(now())
}

model CrmTag {
  id    String    @id @default(cuid())
  name  String
  color String
  leads LeadTag[]
}

model LeadTag {
  leadId String
  tagId  String
  lead   Lead   @relation(fields: [leadId], references: [id], onDelete: Cascade)
  tag    CrmTag @relation(fields: [tagId], references: [id], onDelete: Cascade)
  @@id([leadId, tagId])
}

model WhatsappConnection {
  id        String   @id @default(cuid())
  status    String   // "open" | "close" | "connecting"
  updatedAt DateTime @updatedAt
}

enum MessageDirection { INBOUND OUTBOUND }
enum MessageStatus { SENT DELIVERED READ FAILED }
```

`LeadStage` e `CrmTag` são gerenciáveis pelo usuário (criar/editar/cor) via UI — não fixos no código.

---

## Fluxo de Dados

1. **Webhook da Evolution** (`/api/whatsapp/webhook`): recebe `messages.upsert` → normaliza telefone → upsert `Lead` (cria na `LeadStage` de menor `order` se novo, sem `assignedTo`) → grava `Message` idempotente → emite SSE. Recebe `connection.update` → atualiza `WhatsappConnection.status`.
2. **Envio** (`/api/crm/leads/[id]/messages`, POST): busca `phone` do lead → chama Evolution API → grava `Message` OUTBOUND com `status` resultante.
3. **Status de entrega**: webhook `messages.update` da Evolution → localiza `Message` por `whatsappMessageId` → atualiza `status`.
4. **UI em tempo real**: `GET /api/crm/stream` (SSE) propaga novas mensagens e mudanças de conexão para o Kanban/painel aberto.

---

## Tratamento de Erros e Casos de Borda

- **Mensagem duplicada** (reenvio do webhook): `whatsappMessageId` único — insert duplicado é ignorado, ainda responde 200.
- **Falha no envio**: `Message.status = FAILED`, UI mostra erro com opção de retry.
- **Sessão desconectada** (número deslogado do WhatsApp Web): `WhatsappConnection.status = "close"` dispara banner na UI "WhatsApp desconectado, escaneie o QR novamente"; envio bloqueado até reconectar.
- **Rate limit de envio**: limite simples (ex: N mensagens/minuto) em `/api/whatsapp/send`, mitigação contra flag de spam.
- **Formato de telefone**: normalização E.164 em toda entrada/saída — evita leads duplicados por formatação (com/sem 9º dígito).
- **Mídia** (imagem/áudio/documento): MVP salva como texto placeholder (`"[mídia recebida — tipo: X]"`), sem download/exibição do arquivo.
- **Apagar `LeadStage` com leads**: bloqueado até os leads serem movidos.
- **Autenticação**: todas as rotas `/api/crm/*` e `/api/whatsapp/send` exigem sessão NextAuth; `/api/whatsapp/webhook` é o único endpoint público (validado por origem/secret compartilhado com a instância Evolution).

---

## Pareamento do Número (QR Code)

Tela de "Configurações" dentro da aba CRM exibe o QR code retornado pela Evolution API (`GET /instance/connect/{instance}`) quando `WhatsappConnection.status !== "open"`. Passo manual único (ou sempre que desconectar).

---

## Variáveis de Ambiente

```
EVOLUTION_API_URL=<url do servidor Evolution>
EVOLUTION_API_KEY=<api key da instância>
EVOLUTION_INSTANCE_NAME=<nome da instância>
```

---

## Fora do Escopo (v1)

- Telas separadas de "Caixa de Entrada" vs "Negociações" (fundidas em um único Kanban).
- Múltiplos pipelines / departamentos.
- Multi-tenant (clientes da agência).
- Disparo em massa / campanhas / templates.
- Atribuição automática (round-robin) de leads.
- Download/exibição de mídia recebida.
- Integração com Kanban de Processos ou `SdrDailyLog` existentes.
- Provisionamento da infraestrutura da Evolution API (trabalho de infra separado, pré-requisito).

---

## Decision Log

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| Objetivo: inbox + funil completo | Só disparo automatizado; só métricas | Usuário quer rastreabilidade real de conversa e estágio do lead |
| Conectividade: Evolution API | Meta Cloud API (oficial); BSP (Twilio/Z-API) | Usuário decidiu explicitamente após ser avisado do risco de ban; evita verificação Meta Business e janela de 24h |
| Escopo: própria Melo Mídia, não multi-tenant | CRM como serviço para clientes da agência | Uso é interno, para vendas da própria agência |
| MVP: uma tela (Kanban + painel), não duas | Replicar Inbox + Negociações separados (modelo Kommo) | Reduz escopo do MVP sem perder a funcionalidade núcleo |
| Lead novo: auto-criado na 1ª coluna, sem responsável | Ficar pendente até triagem manual | Time pequeno, simplicidade > controle de fila |
| Tags gerenciáveis pelo usuário | Lista fixa pré-definida | Usuário quer paridade com o exemplo (Kommo) |
| Arquitetura: módulo dedicado (Opção A) | Estender model `Task`/Kanban existente; widget de terceiro embutido | Isola domínio, menor risco, reaproveita padrões existentes (proxy, SSE, dnd-kit) sem acoplar a tarefas internas |
| Sem fila dedicada (BullMQ/SQS) | Fila assíncrona para processar webhook | Volume "centenas/dia" não justifica a complexidade extra; webhook direto no banco com idempotência basta |
| `LeadStage` própria (não reaproveita `Column` do Kanban de Processos) | Reaproveitar `Column` existente | Mistura dois domínios diferentes; risco de acoplamento futuro |
