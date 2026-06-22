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
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
      setStatus('error')
    }
  }

  async function handleSelectClient(client: Client) {
    setSelectedClient(client)
    setSheets([])
    setSelectedSheets([])
    try {
      const res  = await fetch(`/api/automacao/sheets?client_id=${client.id}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setSheets(data.sheets)
      setSelectedSheets(data.sheets)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
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
        let event: Record<string, unknown>
        try { event = JSON.parse(e.data) } catch { return }
        if (event.type === 'log') {
          setLogs(prev => [...prev, String(event.text ?? '')])
        } else if (event.type === 'done') {
          setStatus('done')
          es.close()
        } else if (event.type === 'error') {
          setErrorMsg(String(event.message ?? 'Erro desconhecido.'))
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
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : String(e))
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
