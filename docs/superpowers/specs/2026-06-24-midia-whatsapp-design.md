# Design: Gravar e Enviar Áudio (Nota de Voz) no CRM

**Data:** 2026-06-24
**Status:** Aprovado

---

## Contexto

O usuário pediu sincronização "100% igual ao WhatsApp" no CRM, incluindo ouvir e enviar áudio. Ao investigar o código atual (`git log`), descobriu-se que boa parte já está implementada e em produção (commits `4fb6f9c`, `8663a3e`, `f33ffee` em `master`):

- Visualizar fotos recebidas (`MessageImagePreview` em `lead-conversa-tab.tsx`).
- Ouvir áudios recebidos (`MessageAudioPlayer`).
- Baixar documentos recebidos (`MessageDocumentPreview`).
- Sincronizar histórico completo de conversas antigas (`POST /api/crm/leads/[id]/sync`, usando `findMessages` da Evolution API).
- Rota de mídia (`GET /api/crm/messages/[messageId]/media`) já busca o conteúdo na hora via `POST /chat/getBase64FromMediaMessage/{instance}` da Evolution API, sem guardar cópia própria — exatamente a abordagem que tínhamos desenhado, só que já implementada.

**O que falta de fato**: gravar um áudio pelo microfone do navegador e enviar como mensagem de voz pro lead. O botão de microfone no composer (`lead-conversa-tab.tsx:707-722`) hoje só troca o ícone — não grava nada, e o clique cai no mesmo `handleSend` de texto (que não faz nada com o draft vazio).

Este design cobre **só essa parte que falta**.

---

## Entendimento

- SDR clica no microfone, grava a voz, vê um preview com play/descartar/enviar, e ao confirmar isso é enviado pro lead como nota de voz no WhatsApp real.
- Fora de escopo: enviar foto/documento/vídeo pelo CRM (já decidido antes), upload de arquivo de áudio existente (só gravação na hora).

## Assunções

- **Maior risco técnico**: o endpoint exato da Evolution API pra enviar áudio como nota de voz (`ptt`) não está claro na documentação pública. A primeira tarefa do plano é uma validação empírica direta contra a instância real no Railway, testando o endpoint mais provável (`POST /message/sendWhatsAppAudio/{instance}` com áudio em base64 e `ptt: true`) e documentando o que realmente funciona antes de prosseguir.
- O navegador grava em `audio/webm;codecs=opus` (padrão do `MediaRecorder` no Chrome/Firefox); a Evolution API normalmente converte o áudio recebido via ffmpeg antes de mandar pro WhatsApp, então não devemos precisar fazer conversão de formato no nosso lado — mas isso também será confirmado na validação empírica.
- Limite de gravação: 5 minutos.
- Sem suporte garantido a Safari (fora de escopo, mesma decisão já tomada antes).

---

## Modelo de Dados

**Nenhuma migration necessária.** O sistema já identifica tipo de mídia por substring no campo `content` (`'tipo: áudio'`, `'tipo: imagem'`, `'tipo: documento'`) — ver `renderMessageContent` em `lead-conversa-tab.tsx:316`. Pra reaproveitar o `MessageAudioPlayer` já existente sem tocar nessa lógica, a mensagem de áudio enviada pelo CRM vai usar `content: '[mídia enviada — tipo: áudio]'`, igual ao que o webhook/sync já geram pra áudio recebido/enviado por fora do CRM.

---

## Fluxo

1. **Frontend** (`lead-conversa-tab.tsx`): novo estado de gravação no composer.
   - Clique no microfone (quando draft vazio) → pede permissão (`getUserMedia({ audio: true })`), inicia `MediaRecorder`, mostra timer e botão de parar. Limite de 5 min (auto-stop).
   - Parar → mostra preview: player do áudio gravado + botão "descartar" (X) + botão "enviar" (substitui o textarea temporariamente).
   - "Enviar" → `POST /api/crm/leads/[id]/audio` com o blob gravado (`FormData`). Mensagem aparece otimisticamente na lista (estado pendente), confirmada ou marcada `FAILED` ao final — mesmo padrão do envio de texto hoje.
   - Erro de permissão de microfone → mensagem simples de erro, sem travar o resto da aba.

2. **Backend** `POST /api/crm/leads/[id]/audio` (novo arquivo):
   - Sessão obrigatória (`getServerSession`), mesmo padrão das outras rotas.
   - Rate limit compartilhado com a rota de texto (extrair `checkRateLimit` de `messages/route.ts` pra `src/lib/rate-limit.ts`).
   - Lê o arquivo do `FormData`, converte pra base64.
   - Chama nova função `sendAudioMessage(phone, base64Audio)` em `evolution-client.ts` (implementação definida após a validação empírica da Tarefa 1).
   - Cria `Message` (`direction: 'OUTBOUND'`, `content: '[mídia enviada — tipo: áudio]'`, `status: 'SENT'` ou `'FAILED'`), emite `emitCrmEvent`.

---

## Casos de Borda

- Falha ao enviar (Evolution offline, etc.) → `Message` com `status: 'FAILED'`, mesmo padrão de texto.
- Sem permissão de microfone → erro tratado na UI, sem exceção não tratada.
- Gravação cancelada (descartar) → nada é enviado, estado volta pro composer normal.
- Gravação maior que 5 min → para automaticamente e mostra preview (não trava nem corta silenciosamente sem aviso).

---

## Decision Log

| Decisão | Alternativas consideradas | Por quê |
|---|---|---|
| Reduzir escopo só pra envio de áudio | Reimplementar tudo do design original | Recebimento de mídia e sync de histórico já existem e estão em produção (descoberto via `git log`) |
| Reaproveitar detecção de mídia por substring em `content` | Adicionar coluna `mediaType` | Já existe e funciona; criar coluna nova seria duplicar lógica sem necessidade (YAGNI) |
| Validar endpoint de envio de áudio empiricamente antes de implementar | Confiar na doc pública/memória de treinamento | Doc pública inconsistente; projeto tem histórico de descobrir comportamento real testando direto na instância |
| Extrair `checkRateLimit` pra módulo compartilhado | Duplicar a função na rota de áudio | DRY — mesma razão do design anterior |
