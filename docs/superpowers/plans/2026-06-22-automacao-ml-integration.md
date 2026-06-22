# Automação ML Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar uma aba "Automação ML" no sistemaMelo que controla o serviço FastAPI hospedado na Railway sem login duplo.

**Architecture:** O Next.js cria rotas proxy em `/api/automacao/*` que verificam a sessão next-auth e repassam chamadas ao FastAPI adicionando `X-API-Key` no header. O FastAPI aceita essa chave como alternativa ao login por cookie. O browser usa EventSource normal contra o proxy Next.js, que faz o streaming do SSE do FastAPI.

**Tech Stack:** Next.js 16 App Router, next-auth, FastAPI, Python, TypeScript, Tailwind, lucide-react, shadcn/ui

---

## File Map

**automacaoML** (`C:\Users\hiigo\Desktop\automacaoML`):
- Modify: `backend/server.py` — adicionar suporte a `X-API-Key` em `require_session`

**sistemaMelo** (`C:\Users\hiigo\Desktop\sistemaMelo`):
- Create: `src/lib/automacao-proxy.ts` — helper compartilhado: verifica sessão + chama FastAPI
- Create: `src/app/api/automacao/clients/route.ts`
- Create: `src/app/api/automacao/sheets/route.ts`
- Create: `src/app/api/automacao/run/route.ts`
- Create: `src/app/api/automacao/stream/[jobId]/route.ts`
- Create: `src/app/api/automacao/cancel/route.ts`
- Create: `src/app/api/automacao/status/route.ts`
- Create: `src/components/automacao-ml/automacao-ml-view.tsx`
- Modify: `src/app/page.tsx` — adicionar aba 'automacao-ml'

---

## Task 1: FastAPI — Suporte a X-API-Key

**Files:**
- Modify: `C:\Users\hiigo\Desktop\automacaoML\backend\server.py`

- [ ] **Step 1: Adicionar variável de ambiente `AUTOMACAO_ML_API_KEY`**

Em `backend/server.py`, logo após a linha `_SECRET_KEY = os.getenv(...)`:

```python
_AUTOMACAO_API_KEY = os.getenv("AUTOMACAO_ML_API_KEY", "").strip()
```

- [ ] **Step 2: Modificar `require_session` para aceitar X-API-Key**

Substituir a função `require_session` atual por:

```python
def require_session(request: Request, session: str | None = Cookie(default=None)):
    # Permite acesso via API Key (chamadas do sistemaMelo)
    if _AUTOMACAO_API_KEY:
        header_key = request.headers.get("X-API-Key", "")
        if secrets.compare_digest(header_key.encode(), _AUTOMACAO_API_KEY.encode()):
            return
    # Fallback: auth por cookie (acesso direto ao frontend próprio)
    if not _APP_PASS:
        return
    if not session or not _verify_token(session):
        raise RedirectException("/login")
```

> Nota: O parâmetro `request: Request` é injetado automaticamente pelo FastAPI quando usado como dependência com `Depends(require_session)`. Nenhuma outra mudança nas rotas é necessária.

- [ ] **Step 3: Verificar manualmente que o servidor ainda sobe sem erros**

```bash
cd C:\Users\hiigo\Desktop\automacaoML
python -m uvicorn backend.server:app --host 127.0.0.1 --port 8000
```

Esperado: `Uvicorn running on http://127.0.0.1:8000` sem erros.

- [ ] **Step 4: Commit no repositório automacaoML**

```bash
cd C:\Users\hiigo\Desktop\automacaoML
git add backend/server.py
git commit -m "feat: adiciona suporte a X-API-Key em require_session"
```

- [ ] **Step 5: Fazer deploy no Railway**

```bash
git push origin master
```

Aguardar o deploy terminar no painel da Railway.

---

## Task 2: Proxy Helper no sistemaMelo

**Files:**
- Create: `C:\Users\hiigo\Desktop\sistemaMelo\src\lib\automacao-proxy.ts`

- [ ] **Step 1: Criar o helper**

```typescript
// src/lib/automacao-proxy.ts
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

const BASE_URL = process.env.AUTOMACAO_ML_URL ?? ''
const API_KEY  = process.env.AUTOMACAO_ML_API_KEY ?? ''

/** Verifica sessão next-auth. Retorna NextResponse 401 se não autenticado. */
export async function requireAuth(): Promise<null | NextResponse> {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return null
}

/** Chama o FastAPI com X-API-Key. Retorna o Response cru. */
export function fastapiRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(init?.headers ?? {}),
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\hiigo\Desktop\sistemaMelo
git add src/lib/automacao-proxy.ts
git commit -m "feat: adiciona helper proxy para FastAPI automacaoML"
```

---

## Task 3: Rotas Proxy Simples (clients, sheets, run, cancel, status)

**Files:**
- Create: `src/app/api/automacao/clients/route.ts`
- Create: `src/app/api/automacao/sheets/route.ts`
- Create: `src/app/api/automacao/run/route.ts`
- Create: `src/app/api/automacao/cancel/route.ts`
- Create: `src/app/api/automacao/status/route.ts`

- [ ] **Step 1: Criar rota `/api/automacao/clients`**

```typescript
// src/app/api/automacao/clients/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function GET() {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const res = await fastapiRequest('/api/clients')
  const data = await res.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Criar rota `/api/automacao/sheets`**

```typescript
// src/app/api/automacao/sheets/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function GET(request: Request) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('client_id') ?? ''

  const res = await fastapiRequest(`/api/sheets?client_id=${encodeURIComponent(clientId)}`)
  const data = await res.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 3: Criar rota `/api/automacao/run`**

```typescript
// src/app/api/automacao/run/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function POST(request: Request) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const body = await request.json()
  const res = await fastapiRequest('/api/run', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Criar rota `/api/automacao/cancel`**

```typescript
// src/app/api/automacao/cancel/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function POST() {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const res = await fastapiRequest('/api/cancel', { method: 'POST' })
  const data = await res.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 5: Criar rota `/api/automacao/status`**

```typescript
// src/app/api/automacao/status/route.ts
import { NextResponse } from 'next/server'
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function GET() {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const res = await fastapiRequest('/api/status')
  const data = await res.json()
  return NextResponse.json(data)
}
```

- [ ] **Step 6: Commit**

```bash
cd C:\Users\hiigo\Desktop\sistemaMelo
git add src/app/api/automacao/
git commit -m "feat: adiciona rotas proxy para automacaoML (clients, sheets, run, cancel, status)"
```

---

## Task 4: Rota Proxy SSE (stream)

**Files:**
- Create: `src/app/api/automacao/stream/[jobId]/route.ts`

A rota SSE repassa o stream do FastAPI diretamente para o browser usando `ReadableStream`.

- [ ] **Step 1: Criar rota**

```typescript
// src/app/api/automacao/stream/[jobId]/route.ts
import { requireAuth, fastapiRequest } from '@/lib/automacao-proxy'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const unauth = await requireAuth()
  if (unauth) return unauth

  const { jobId } = await params

  const fastapiRes = await fastapiRequest(`/api/stream/${jobId}`)

  return new Response(fastapiRes.body, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\hiigo\Desktop\sistemaMelo
git add src/app/api/automacao/stream/
git commit -m "feat: adiciona rota proxy SSE para stream de logs da automação"
```

---

## Task 5: Componente AutomacaoMLView

**Files:**
- Create: `src/components/automacao-ml/automacao-ml-view.tsx`

- [ ] **Step 1: Criar o componente**

```typescript
// src/components/automacao-ml/automacao-ml-view.tsx
'use client'

import { useState, useEffect, useRef } from 'react'
import { Bot, Play, Square, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Status = 'loading' | 'ready' | 'running' | 'done' | 'error' | 'cancelled'

interface Client { id: string; name: string }

export function AutomacaoMLView() {
  const [status, setStatus]               = useState<Status>('loading')
  const [clients, setClients]             = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [sheets, setSheets]               = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [logs, setLogs]                   = useState<string[]>([])
  const [errorMsg, setErrorMsg]           = useState<string | null>(null)
  const logsEndRef                        = useRef<HTMLDivElement>(null)
  const esRef                             = useRef<EventSource | null>(null)

  useEffect(() => {
    loadClients()
    return () => { esRef.current?.close() }
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  async function loadClients() {
    setStatus('loading')
    setErrorMsg(null)
    try {
      const res  = await fetch('/api/automacao/clients')
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setClients(data.clients)
      setStatus('ready')
    } catch (e: any) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  async function handleSelectClient(client: Client) {
    setSelectedClient(client)
    setSheets([])
    setSelectedSheets([])
    try {
      const res  = await fetch(`/api/automacao/sheets?client_id=${client.id}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setSheets(data.sheets)
      setSelectedSheets(data.sheets)
    } catch (e: any) {
      setErrorMsg(e.message)
    }
  }

  function toggleSheet(sheet: string) {
    setSelectedSheets(prev =>
      prev.includes(sheet) ? prev.filter(s => s !== sheet) : [...prev, sheet]
    )
  }

  async function handleRun() {
    if (!selectedClient) return
    setLogs([])
    setErrorMsg(null)
    setStatus('running')

    try {
      const res  = await fetch('/api/automacao/run', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          clients:       [{ id: selectedClient.id, name: selectedClient.name }],
          delay_seconds: 20,
          sheets_filter: selectedSheets.length > 0 ? selectedSheets : undefined,
        }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)

      const es = new EventSource(`/api/automacao/stream/${data.job_id}`)
      esRef.current = es

      es.onmessage = (e) => {
        const event = JSON.parse(e.data)
        if (event.type === 'log') {
          setLogs(prev => [...prev, event.text])
        } else if (event.type === 'done') {
          setStatus('done')
          es.close()
        } else if (event.type === 'error') {
          setErrorMsg(event.message ?? 'Erro desconhecido.')
          setStatus('error')
          es.close()
        } else if (event.type === 'cancelled') {
          setStatus('cancelled')
          es.close()
        }
      }

      es.onerror = () => {
        setErrorMsg('Conexão com o servidor perdida.')
        setStatus('error')
        es.close()
      }
    } catch (e: any) {
      setErrorMsg(e.message)
      setStatus('error')
    }
  }

  async function handleCancel() {
    esRef.current?.close()
    await fetch('/api/automacao/cancel', { method: 'POST' })
    setStatus('cancelled')
  }

  const isRunning = status === 'running'

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 ring-1 ring-white/10">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-heading)' }}>
              Automação ML
            </h1>
            <p className="text-xs text-slate-400">Geração de anúncios para o Mercado Livre</p>
          </div>
        </div>

        {/* Config card */}
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-4">

          {/* Cliente */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-300">Cliente</label>
            {status === 'loading' ? (
              <p className="text-sm text-slate-500">Carregando clientes...</p>
            ) : (
              <select
                disabled={isRunning}
                value={selectedClient?.id ?? ''}
                onChange={e => {
                  const c = clients.find(c => c.id === e.target.value)
                  if (c) handleSelectClient(c)
                }}
                className="w-full bg-white/[0.05] border border-white/[0.1] rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/20 disabled:opacity-50"
              >
                <option value="" disabled>Selecione um cliente...</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id} className="bg-[#07080c]">{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Abas */}
          {sheets.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Abas da planilha</label>
              <div className="flex flex-wrap gap-2">
                {sheets.map(sheet => (
                  <button
                    key={sheet}
                    disabled={isRunning}
                    onClick={() => toggleSheet(sheet)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all disabled:opacity-50 ${
                      selectedSheets.includes(sheet)
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white'
                    }`}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            {!isRunning ? (
              <>
                <Button
                  onClick={handleRun}
                  disabled={!selectedClient || status === 'loading'}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Rodar Automação
                </Button>
                {(status === 'done' || status === 'error' || status === 'cancelled') && (
                  <Button
                    variant="ghost"
                    onClick={loadClients}
                    className="text-slate-400 hover:text-white hover:bg-white/[0.06]"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Reiniciar
                  </Button>
                )}
              </>
            ) : (
              <Button
                onClick={handleCancel}
                className="bg-red-600/80 hover:bg-red-600 text-white border-0"
              >
                <Square className="w-4 h-4 mr-2" />
                Cancelar
              </Button>
            )}
          </div>
        </div>

        {/* Status badge */}
        {status !== 'loading' && status !== 'ready' && (
          <div className={`text-xs font-medium px-3 py-1.5 rounded-full w-fit ${
            status === 'running'   ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            status === 'done'      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            status === 'cancelled' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {status === 'running'   && '⏳ Executando...'}
            {status === 'done'      && '✅ Concluído'}
            {status === 'cancelled' && '⛔ Cancelado'}
            {status === 'error'     && `❌ Erro: ${errorMsg}`}
          </div>
        )}

        {/* Terminal de logs */}
        {logs.length > 0 && (
          <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-4 font-mono text-xs text-slate-300 max-h-96 overflow-y-auto">
            {logs.map((line, i) => (
              <div key={i} className="leading-relaxed whitespace-pre-wrap">{line}</div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:\Users\hiigo\Desktop\sistemaMelo
git add src/components/automacao-ml/
git commit -m "feat: adiciona componente AutomacaoMLView"
```

---

## Task 6: Adicionar Aba no page.tsx

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Importar o componente e o ícone**

No topo do arquivo, adicionar à linha de imports do lucide-react o ícone `Bot` e importar o componente:

```typescript
import { LayoutDashboard, ClipboardList, LogOut, User, BarChart, GraduationCap, Bot } from 'lucide-react'
import { AutomacaoMLView } from '@/components/automacao-ml/automacao-ml-view'
```

- [ ] **Step 2: Expandir o tipo ActiveTab**

```typescript
type ActiveTab = 'kanban' | 'mentoria' | 'tasks' | 'dashboard' | 'automacao-ml'
```

- [ ] **Step 3: Adicionar botão na nav**

Dentro do `<nav>`, após o botão "Dashboard", adicionar:

```tsx
<button
  onClick={() => setActiveTab('automacao-ml')}
  className={`
    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer
    ${activeTab === 'automacao-ml'
      ? 'bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-white shadow-lg shadow-emerald-500/20'
      : 'text-slate-400 hover:text-white hover:bg-white/[0.06]'
    }
  `}
>
  <Bot className="w-4 h-4" />
  Automação ML
</button>
```

- [ ] **Step 4: Renderizar o componente na área de conteúdo**

Dentro do `<main>`, após `{activeTab === 'dashboard' && <DashboardView />}`, adicionar:

```tsx
{activeTab === 'automacao-ml' && <AutomacaoMLView />}
```

- [ ] **Step 5: Commit**

```bash
cd C:\Users\hiigo\Desktop\sistemaMelo
git add src/app/page.tsx
git commit -m "feat: adiciona aba Automação ML no nav do sistemaMelo"
```

---

## Task 7: Variáveis de Ambiente e Deploy

- [ ] **Step 1: Adicionar variáveis no Railway (automacaoML)**

No painel da Railway, no serviço automacaoML, adicionar:

```
AUTOMACAO_ML_API_KEY=<gere um segredo — ex: openssl rand -hex 32>
```

- [ ] **Step 2: Adicionar variáveis na Vercel (sistemaMelo)**

No painel da Vercel, em Settings → Environment Variables, adicionar:

```
AUTOMACAO_ML_URL=https://<seu-app>.up.railway.app
AUTOMACAO_ML_API_KEY=<mesmo segredo gerado acima>
```

- [ ] **Step 3: Fazer deploy do sistemaMelo**

```bash
cd C:\Users\hiigo\Desktop\sistemaMelo
git push origin master
```

- [ ] **Step 4: Verificar funcionamento**

1. Abrir o sistemaMelo no navegador
2. Fazer login
3. Clicar na aba "Automação ML"
4. Confirmar que a lista de clientes carrega
5. Selecionar um cliente e verificar que as abas aparecem
6. Clicar "Rodar Automação" e confirmar que os logs aparecem em tempo real
