# Design: Integração Automação ML no SistemaMelo

**Data:** 2026-06-22  
**Status:** Aprovado

---

## Contexto

O `automacaoML` é um serviço Python/FastAPI hospedado na Railway que lê produtos do Google Sheets e gera anúncios para o Mercado Livre via OpenAI. O `sistemaMelo` é uma aplicação Next.js hospedada na Vercel com autenticação next-auth.

O objetivo é expor a automação como uma nova aba no sistemaMelo, com acesso transparente (quem está logado no sistemaMelo não precisa logar novamente).

---

## Arquitetura

```
Navegador
  └── sistemaMelo (Vercel)
        ├── src/app/page.tsx              — nova aba "Automação ML"
        ├── src/components/automacao-ml/
        │     └── automacao-ml-view.tsx   — tela completa
        └── src/app/api/automacao/
              ├── clients/route.ts
              ├── sheets/route.ts
              ├── run/route.ts
              ├── stream/[jobId]/route.ts
              ├── cancel/route.ts
              └── status/route.ts
                        ↓ header X-API-Key
              FastAPI na Railway (automacaoML — já existe e está no ar)
```

---

## Autenticação Transparente

**Mecanismo:** API Key compartilhada entre os dois serviços.

- `AUTOMACAO_ML_URL` — URL base do FastAPI na Railway (ex: `https://automacaoml.up.railway.app`)
- `AUTOMACAO_ML_API_KEY` — segredo aleatório (ex: 32 hex chars), definido em ambos os lados

**No FastAPI (`backend/server.py`):**  
Modificar `require_session` para aceitar também o header `X-API-Key`. Se o header estiver presente e for válido, a requisição é liberada sem verificação de cookie.

**Nas rotas Next.js:**  
Cada route handler verifica a sessão next-auth (`getServerSession`). Se não estiver logado, retorna 401. Se estiver, repassa a chamada ao FastAPI com `X-API-Key` no header.

---

## Rotas Proxy (Next.js → FastAPI)

| Rota Next.js | Método | FastAPI destino |
|---|---|---|
| `/api/automacao/clients` | GET | `GET /api/clients` |
| `/api/automacao/sheets` | GET | `GET /api/sheets?client_id=...` |
| `/api/automacao/run` | POST | `POST /api/run` |
| `/api/automacao/stream/[jobId]` | GET | `GET /api/stream/{job_id}` (SSE) |
| `/api/automacao/cancel` | POST | `POST /api/cancel` |
| `/api/automacao/status` | GET | `GET /api/status` |

A rota de stream usa `ReadableStream` para fazer proxy do SSE em tempo real.

---

## Componente `AutomacaoMLView`

Fluxo da tela:

1. **Montagem** → chama `/api/automacao/clients`, exibe lista de clientes
2. **Seleção de cliente** → chama `/api/automacao/sheets?client_id=...`, exibe checkboxes de abas (todas selecionadas por padrão)
3. **Botão Rodar** → POST `/api/automacao/run` com `{ clients: [...], delay_seconds: 20 }` → recebe `job_id`
4. **Stream de logs** → conecta ao SSE `/api/automacao/stream/{job_id}`, exibe linhas em tempo real num terminal
5. **Botão Cancelar** → POST `/api/automacao/cancel`, desconecta SSE

Estados da UI: `idle | loading | running | done | error | cancelled`

---

## Alterações no `page.tsx`

- Adicionar `'automacao-ml'` ao tipo `ActiveTab`
- Adicionar botão na nav com ícone `Bot` (lucide-react) e texto "Automação ML"
- Cor do gradiente ativo: `from-emerald-600/90 to-teal-600/90` (distinto dos outros)
- Renderizar `<AutomacaoMLView />` quando `activeTab === 'automacao-ml'`

---

## Variáveis de Ambiente

**Vercel (sistemaMelo):**
```
AUTOMACAO_ML_URL=https://<seu-app>.up.railway.app
AUTOMACAO_ML_API_KEY=<segredo>
```

**Railway (automacaoML):**
```
AUTOMACAO_ML_API_KEY=<mesmo segredo>
```

---

## Fora do Escopo

- Histórico de execuções (não persiste no banco)
- Seleção de delay customizado na UI (usa o padrão de 20s)
- Múltiplas execuções simultâneas (FastAPI já bloqueia isso)
