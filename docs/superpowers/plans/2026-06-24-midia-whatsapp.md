# Gravar e Enviar Áudio (Nota de Voz) no CRM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o SDR grave um áudio pelo microfone do navegador, direto na aba "Conversa" do lead, e envie como mensagem de voz real pro WhatsApp do lead.

**Architecture:** Frontend grava com `MediaRecorder` (formato nativo do navegador, sem conversão), envia o blob via `multipart/form-data` pra uma nova rota Next.js, que converte pra base64 e chama a Evolution API (`POST /message/sendWhatsAppAudio/{instance}`, endpoint já validado empiricamente contra a instância real do Railway). A mensagem enviada é salva na tabela `Message` já existente, reaproveitando a detecção de mídia por substring (`'tipo: áudio'`) que o `lead-conversa-tab.tsx` já usa pra mensagens recebidas — **sem migration de schema**.

**Tech Stack:** Next.js App Router (route handlers), Prisma, `MediaRecorder` Web API, Evolution API (self-hosted, instância `sistemamelo`).

**Validação já realizada (não repetir):** o orquestrador já testou `POST /message/sendWhatsAppAudio/sistemamelo` com `{ number, audio: <base64>, ptt: true }` direto contra a instância real do Railway, em dois formatos (`ogg/opus` e `webm/opus` — o formato que o `MediaRecorder` do navegador realmente produz). Os dois retornaram HTTP 201 com `audioMessage.ptt: true`, e o usuário confirmou ao vivo no WhatsApp que ambos chegaram como nota de voz normal, tocando corretamente. **Não é necessário nenhum passo de conversão de formato no backend.**

---

## Arquivos

- Criar: `src/lib/rate-limit.ts` — extrai o rate limiter já existente em `messages/route.ts` pra um módulo compartilhado.
- Modificar: `src/app/api/crm/leads/[id]/messages/route.ts` — usa o rate limiter compartilhado em vez da cópia local.
- Modificar: `src/lib/evolution-client.ts` — adiciona `sendAudioMessage`.
- Criar: `src/app/api/crm/leads/[id]/audio/route.ts` — recebe o áudio gravado e envia pra Evolution API.
- Modificar: `src/hooks/crm-api.ts` — adiciona `useSendAudioMessage`.
- Modificar: `src/components/crm/lead-conversa-tab.tsx` — UI de gravação (estado + render).

---

### Task 1: Extrair rate limiter compartilhado

**Files:**
- Create: `src/lib/rate-limit.ts`
- Modify: `src/app/api/crm/leads/[id]/messages/route.ts`

- [ ] **Step 1: Criar o módulo compartilhado**

```typescript
// src/lib/rate-limit.ts
const RATE_LIMIT_PER_MINUTE = 30
const sentTimestamps: number[] = []

export function checkRateLimit(): boolean {
  const now = Date.now()
  while (sentTimestamps.length && now - sentTimestamps[0] > 60_000) sentTimestamps.shift()
  if (sentTimestamps.length >= RATE_LIMIT_PER_MINUTE) return false
  sentTimestamps.push(now)
  return true
}
```

- [ ] **Step 2: Atualizar `messages/route.ts` pra usar o módulo compartilhado**

Em `src/app/api/crm/leads/[id]/messages/route.ts`, remova estas linhas do topo do arquivo:

```typescript
const RATE_LIMIT_PER_MINUTE = 30
const sentTimestamps: number[] = []

function checkRateLimit(): boolean {
  const now = Date.now()
  while (sentTimestamps.length && now - sentTimestamps[0] > 60_000) sentTimestamps.shift()
  if (sentTimestamps.length >= RATE_LIMIT_PER_MINUTE) return false
  sentTimestamps.push(now)
  return true
}
```

E adicione este import no topo do arquivo (junto aos outros imports):

```typescript
import { checkRateLimit } from '@/lib/rate-limit'
```

O resto do arquivo (a chamada `if (!checkRateLimit())` dentro de `POST`) não muda — só passa a usar a função importada.

- [ ] **Step 3: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros relacionados a `checkRateLimit` ou `rate-limit`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/rate-limit.ts src/app/api/crm/leads/[id]/messages/route.ts
git commit -m "refactor: extrai rate limiter de envio pra modulo compartilhado"
```

---

### Task 2: Adicionar `sendAudioMessage` ao cliente da Evolution API

**Files:**
- Modify: `src/lib/evolution-client.ts`

- [ ] **Step 1: Adicionar a função**

No final de `src/lib/evolution-client.ts`, adicione:

```typescript
export async function sendAudioMessage(phone: string, base64Audio: string): Promise<SendTextResult> {
  const res = await evolutionRequest(`/message/sendWhatsAppAudio/${INSTANCE}`, {
    method: 'POST',
    body: JSON.stringify({ number: phone, audio: base64Audio, ptt: true }),
  })
  if (!res.ok) throw new Error(`Evolution API retornou ${res.status}`)
  const data = await res.json()
  if (!data?.key?.id) throw new Error('Resposta da Evolution API sem ID de mensagem')
  return data as SendTextResult
}
```

Reaproveita a interface `SendTextResult` já definida no mesmo arquivo (`{ key: { id: string } }`) — mesma forma de resposta que `sendTextMessage` já trata.

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/lib/evolution-client.ts
git commit -m "feat: adiciona sendAudioMessage ao cliente da Evolution API"
```

---

### Task 3: Rota de envio de áudio

**Files:**
- Create: `src/app/api/crm/leads/[id]/audio/route.ts`

- [ ] **Step 1: Criar a rota**

```typescript
// src/app/api/crm/leads/[id]/audio/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { sendAudioMessage } from '@/lib/evolution-client'
import { emitCrmEvent } from '@/lib/crm-events'
import { checkRateLimit } from '@/lib/rate-limit'
import { randomUUID } from 'crypto'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!checkRateLimit()) {
    return NextResponse.json({ error: 'Limite de envio atingido, aguarde um minuto' }, { status: 429 })
  }

  const { id } = await params
  const lead = await prisma.lead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  const formData = await request.formData()
  const file = formData.get('audio')
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Arquivo de áudio não enviado' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const base64Audio = buffer.toString('base64')
  const content = '[mídia enviada — tipo: áudio]'

  try {
    const result = await sendAudioMessage(lead.phone, base64Audio)
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: result.key.id,
        direction: 'OUTBOUND',
        content,
        status: 'SENT',
      },
    })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(message)
  } catch (error) {
    const message = await prisma.message.create({
      data: {
        leadId: lead.id,
        whatsappMessageId: `failed-${randomUUID()}`,
        direction: 'OUTBOUND',
        content,
        status: 'FAILED',
      },
    })
    emitCrmEvent({ type: 'new-message', leadId: lead.id, message })
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha ao enviar áudio' },
      { status: 502 }
    )
  }
}
```

Esse arquivo segue exatamente o mesmo padrão de `src/app/api/crm/leads/[id]/messages/route.ts` (auth, rate limit, lead lookup, try/catch com `Message` `FAILED` em caso de erro).

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Testar manualmente contra a Evolution real**

Usar o mesmo número de teste seguro já validado pelo orquestrador (não usar nenhum lead real de cliente). Pedir ao orquestrador/usuário o número exato e as credenciais da Evolution (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE_NAME`) se precisar testar fora da aplicação — mas o teste real desse endpoint específico (via app, autenticado) será feito na Task 7 (verificação ponta a ponta), não aqui.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/crm/leads/[id]/audio/route.ts"
git commit -m "feat: adiciona rota de envio de audio gravado para o lead"
```

---

### Task 4: Hook `useSendAudioMessage`

**Files:**
- Modify: `src/hooks/crm-api.ts`

- [ ] **Step 1: Adicionar o hook**

Logo abaixo de `useSendMessage` em `src/hooks/crm-api.ts` (mesma seção `// ——— Messages ———`), adicione:

```typescript
export function useSendAudioMessage(leadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (audioBlob: Blob) => {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'audio.webm')
      const res = await fetch(`/api/crm/leads/${leadId}/audio`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send audio')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['crm-messages', leadId] })
      qc.invalidateQueries({ queryKey: ['crm-stages'] })
    },
  })
}
```

Mesmo padrão de `useSendMessage` (mesmas queries invalidadas), só troca o `body` de JSON pra `FormData`.

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/crm-api.ts
git commit -m "feat: adiciona hook useSendAudioMessage"
```

---

### Task 5: Estado de gravação no `LeadConversaTab`

**Files:**
- Modify: `src/components/crm/lead-conversa-tab.tsx`

- [ ] **Step 1: Atualizar imports**

No topo do arquivo, troque a linha de import dos hooks:

```typescript
import { useLeadMessages, useSendMessage, useSyncLeadMessages } from '@/hooks/crm-api'
```

por:

```typescript
import { useLeadMessages, useSendMessage, useSyncLeadMessages, useSendAudioMessage } from '@/hooks/crm-api'
```

E troque a linha de import de ícones:

```typescript
import { Send, Smile, Paperclip, Mic, Check, CheckCheck, MessageSquare, Lock, Zap, Clock, RefreshCw, Play, Pause } from 'lucide-react'
```

por:

```typescript
import { Send, Smile, Paperclip, Mic, Check, CheckCheck, MessageSquare, Lock, Zap, Clock, RefreshCw, Play, Pause, Square, Trash2 } from 'lucide-react'
```

- [ ] **Step 2: Adicionar estado e refs**

Dentro de `LeadConversaTab`, logo após a linha `const syncMessages = useSyncLeadMessages()`, adicione:

```typescript
  const sendAudio = useSendAudioMessage(leadId)

  const [recordingState, setRecordingState] = useState<'idle' | 'recording' | 'preview'>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [micError, setMicError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const MAX_RECORDING_SECONDS = 300
```

- [ ] **Step 3: Adicionar handlers de gravação**

Logo após a função `handleFileChange` (antes de `formatTime`), adicione:

```typescript
  async function handleStartRecording() {
    setMicError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      recordedChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const blob = new Blob(recordedChunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        setRecordedBlob(blob)
        setPreviewUrl(URL.createObjectURL(blob))
        setRecordingState('preview')
      }

      mediaRecorderRef.current = recorder
      recorder.start()
      setRecordingState('recording')
      setRecordingSeconds(0)

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          if (prev + 1 >= MAX_RECORDING_SECONDS) {
            handleStopRecording()
            return prev
          }
          return prev + 1
        })
      }, 1000)
    } catch {
      setMicError('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  function handleStopRecording() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }
    mediaRecorderRef.current?.stop()
  }

  function handleDiscardRecording() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setRecordedBlob(null)
    setPreviewUrl(null)
    setRecordingState('idle')
    setRecordingSeconds(0)
  }

  function handleSendRecording() {
    if (!recordedBlob || sendAudio.isPending) return
    sendAudio.mutate(recordedBlob, {
      onSuccess: () => {
        if (previewUrl) URL.revokeObjectURL(previewUrl)
        setRecordedBlob(null)
        setPreviewUrl(null)
        setRecordingState('idle')
        setRecordingSeconds(0)
      },
    })
  }

  function handleMicButtonClick() {
    if (recordingState === 'idle') {
      handleStartRecording()
    } else if (recordingState === 'recording') {
      handleStopRecording()
    }
  }

  function formatRecordingTime(totalSeconds: number) {
    const mins = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }
```

- [ ] **Step 4: Adicionar cleanup no unmount**

Logo após o `useEffect` que faz `document.addEventListener('mousedown', handleClickOutside)`, adicione um novo `useEffect`:

```typescript
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])
```

- [ ] **Step 5: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/components/crm/lead-conversa-tab.tsx
git commit -m "feat: adiciona estado e logica de gravacao de audio no LeadConversaTab"
```

---

### Task 6: Renderizar a UI de gravação

**Files:**
- Modify: `src/components/crm/lead-conversa-tab.tsx`

- [ ] **Step 1: Substituir o bloco do composer**

Localize este bloco (a área de composição, antes do fechamento do componente):

```typescript
      {/* Composing Input area */}
      <div className="p-3 bg-[#121517] flex gap-3 items-end border-t border-white/[0.04] select-none relative">
        {/* Composing text card */}
        <div className="flex-1 bg-[#1e2225] rounded-xl border border-white/[0.04] p-2 flex flex-col relative min-h-[96px]">
```

Substitua **todo o `<div>` da "Composing text card"** (do `<div className="flex-1 bg-[#1e2225] ...">` até o `</div>` que o fecha, mantendo o textarea e o toolbar exatamente como estão dentro) por uma renderização condicional. O resultado final desse trecho deve ficar assim:

```typescript
      {/* Composing Input area */}
      <div className="p-3 bg-[#121517] flex gap-3 items-end border-t border-white/[0.04] select-none relative">
        {recordingState === 'recording' ? (
          <div className="flex-1 flex items-center gap-3 bg-[#1e2225] rounded-xl border border-red-500/30 p-3 min-h-[96px]">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm text-white font-medium">Gravando... {formatRecordingTime(recordingSeconds)}</span>
            <span className="text-xs text-slate-500 ml-auto">Clique no botão pra parar</span>
          </div>
        ) : recordingState === 'preview' ? (
          <div className="flex-1 flex items-center gap-3 bg-[#1e2225] rounded-xl border border-white/[0.04] p-3 min-h-[96px]">
            <button
              type="button"
              onClick={handleDiscardRecording}
              className="p-2 rounded-full text-red-400 hover:bg-red-500/10 cursor-pointer shrink-0"
            >
              <Trash2 className="w-4.5 h-4.5" />
            </button>
            {previewUrl && <audio controls src={previewUrl} className="flex-1 h-9" />}
          </div>
        ) : (
          <div className="flex-1 bg-[#1e2225] rounded-xl border border-white/[0.04] p-2 flex flex-col relative min-h-[96px]">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder={activeMode === 'responder' ? "Digite uma mensagem..." : "Adicione uma nota interna..."}
              className="bg-transparent border-none text-[#e9edef] placeholder-[#8696a0]/80 w-full text-sm outline-none resize-none flex-1 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none min-h-[44px] px-1 py-1"
            />

            {/* Toolbar row */}
            <div className="flex items-center gap-1.5 pt-2 border-t border-white/[0.03] mt-1 select-none">
              {/* Attach */}
              <button
                type="button"
                onClick={() => {
                  setShowAttachMenu(!showAttachMenu)
                  setShowEmojiPicker(false)
                  setShowTemplates(false)
                }}
                className={`p-1.5 rounded-md hover:bg-white/5 transition-colors duration-150 cursor-pointer ${
                  showAttachMenu ? 'text-[#00a884]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Paperclip className="w-4.5 h-4.5 rotate-45 shrink-0" />
              </button>

              {/* Quick templates */}
              <button
                type="button"
                onClick={() => {
                  setShowTemplates(!showTemplates)
                  setShowEmojiPicker(false)
                  setShowAttachMenu(false)
                }}
                className={`p-1.5 rounded-md hover:bg-white/5 transition-colors duration-150 cursor-pointer ${
                  showTemplates ? 'text-[#00a884]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Zap className="w-4.5 h-4.5 shrink-0" />
              </button>

              {/* Emoji */}
              <button
                type="button"
                onClick={() => {
                  setShowEmojiPicker(!showEmojiPicker)
                  setShowAttachMenu(false)
                  setShowTemplates(false)
                }}
                className={`p-1.5 rounded-md hover:bg-white/5 transition-colors duration-150 cursor-pointer ${
                  showEmojiPicker ? 'text-[#00a884]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Smile className="w-4.5 h-4.5 shrink-0" />
              </button>

              {/* Clock */}
              <button
                type="button"
                onClick={() => alert('Agendamento de mensagens indisponível')}
                className="p-1.5 rounded-md hover:bg-white/5 transition-colors duration-150 cursor-pointer text-slate-400 hover:text-slate-200 shrink-0"
              >
                <Clock className="w-4.5 h-4.5 shrink-0" />
              </button>
            </div>
          </div>
        )}

        {/* Floating Action Button */}
        <button
          type="button"
          onClick={
            recordingState === 'preview'
              ? handleSendRecording
              : recordingState === 'recording'
                ? handleMicButtonClick
                : draft.trim()
                  ? handleSend
                  : handleMicButtonClick
          }
          disabled={sendMessage.isPending || sendAudio.isPending}
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg transition-all duration-200 cursor-pointer ${
            activeMode === 'responder'
              ? 'bg-[#00a884] hover:bg-[#009675] text-white'
              : 'bg-[#e2a03f] hover:bg-[#c98629] text-white'
          } disabled:opacity-50`}
        >
          {recordingState === 'recording' ? (
            <Square className="w-4 h-4 fill-current" />
          ) : recordingState === 'preview' ? (
            <Send className="w-5 h-5 fill-current ml-0.5" />
          ) : draft.trim() ? (
            <Send className="w-5 h-5 fill-current ml-0.5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>

      {micError && (
        <div className="absolute bottom-[110px] left-4 right-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-lg px-3 py-2 z-50">
          {micError}
        </div>
      )}
```

Note que o `<input type="file" ... />` oculto que já existe **antes** desse bloco no arquivo não muda — fica onde está.

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/crm/lead-conversa-tab.tsx
git commit -m "feat: renderiza UI de gravacao (gravando/preview) no composer da conversa"
```

---

### Task 7: Verificação ponta a ponta

**Files:** nenhum (só verificação)

- [ ] **Step 1: Build completo**

Run: `npm run build`
Expected: build conclui sem erros de tipo ou lint.

- [ ] **Step 2: Teste manual no navegador (Playwright, via skill webapp-testing)**

Com o servidor de dev rodando (`npm run dev`), abrir o CRM, entrar em um lead, clicar no microfone, gravar ~2s, parar, confirmar que aparece o preview com player + botões de descartar/enviar. Testar o fluxo de descartar (volta pro composer normal) e o fluxo de enviar.

**Importante:** o envio real só deve ser testado contra o número de teste seguro já usado nas validações anteriores desta sessão (o próprio número conectado à instância da Evolution) — nunca contra um lead de cliente real. Se for necessário um lead de teste no banco local/produção pra esse teste, perguntar ao usuário antes de criar ou usar qualquer lead.

- [ ] **Step 3: Confirmação final com o usuário**

Depois do teste no navegador, pedir ao usuário pra abrir o WhatsApp dele e confirmar que o áudio gravado e enviado pelo CRM chegou como nota de voz normal (mesma confirmação já feita nos testes de validação direta da API).

- [ ] **Step 4: Commit final (se houver ajustes)**

Se a verificação não exigir nenhuma mudança de código, não há commit nesta tarefa — ela é só de validação.
