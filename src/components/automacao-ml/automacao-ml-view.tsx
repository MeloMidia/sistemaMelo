'use client'

import { Fragment, useState, useEffect, useRef } from 'react'
import { Bot, Play, Square, RefreshCw, Folder, ChevronRight, Search, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Status = 'loading' | 'ready' | 'running' | 'done' | 'error' | 'cancelled'
type SheetsState = 'idle' | 'loading' | 'ready' | 'empty' | 'error'

interface DriveFolder { id: string; name: string }

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error))

/** Subpastas de uma pasta de MERCADO LIVRE; sem `parent`, da própria raiz. */
async function fetchFolder(parent?: DriveFolder): Promise<{ folder: DriveFolder; folders: DriveFolder[] }> {
  const query = parent ? `?parent_id=${encodeURIComponent(parent.id)}` : ''
  const res = await fetch(`/api/automacao/clients${query}`)
  if (!res.ok) throw new Error(`Erro HTTP ${res.status} na rota proxy.`)
  const data = await res.json()
  if (!data.ok) throw new Error(data.error || data.message || 'Erro desconhecido do servidor.')
  // Servidor antigo ignora parent_id e devolve a raiz de novo.
  if (parent && data.folder?.id !== parent.id) {
    throw new Error('O servidor da automação ainda não abre subpastas: falta publicar a versão nova dele.')
  }
  return { folder: data.folder ?? { id: '', name: 'Mercado Livre' }, folders: data.clients }
}

export function AutomacaoMLView() {
  const [status, setStatus]               = useState<Status>('loading')
  const [path, setPath]                   = useState<DriveFolder[]>([])
  const [folders, setFolders]             = useState<DriveFolder[]>([])
  const [foldersLoading, setFoldersLoading] = useState(false)
  const [folderError, setFolderError]     = useState<string | null>(null)
  const [filter, setFilter]               = useState('')
  const [selectedClient, setSelectedClient] = useState<DriveFolder | null>(null)
  const [sheets, setSheets]               = useState<string[]>([])
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  const [sheetsState, setSheetsState]     = useState<SheetsState>('idle')
  const [sheetsError, setSheetsError]     = useState<string | null>(null)
  const [logs, setLogs]                   = useState<string[]>([])
  const [errorMsg, setErrorMsg]           = useState<string | null>(null)
  const logsEndRef                        = useRef<HTMLDivElement>(null)
  const esRef                             = useRef<EventSource | null>(null)
  // Cliques rápidos: só a resposta do último pedido vale.
  const folderRequestRef                  = useRef(0)
  const sheetsRequestRef                  = useRef(0)

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
    const request = ++folderRequestRef.current
    try {
      const { folder, folders } = await fetchFolder()
      if (request !== folderRequestRef.current) return
      setPath([folder])
      setFolders(folders)
      setFolderError(null)
      setFilter('')
      setStatus('ready')
      await checkRunningStatus()
    } catch (e) {
      if (request !== folderRequestRef.current) return
      setErrorMsg(errorText(e))
      setStatus('error')
    }
  }

  /** Abre a última pasta de `nextPath`; com uma pasta só, volta para a raiz. */
  async function openFolder(nextPath: DriveFolder[]) {
    const request = ++folderRequestRef.current
    setFoldersLoading(true)
    setFolderError(null)
    setFilter('')
    try {
      const { folder, folders } = await fetchFolder(nextPath.length > 1 ? nextPath[nextPath.length - 1] : undefined)
      if (request !== folderRequestRef.current) return
      setPath(nextPath.length > 1 ? nextPath : [folder])
      setFolders(folders)
    } catch (e) {
      if (request !== folderRequestRef.current) return
      setFolderError(errorText(e))
    } finally {
      if (request === folderRequestRef.current) setFoldersLoading(false)
    }
  }

  async function checkRunningStatus() {
    try {
      const res  = await fetch('/api/automacao/status')
      if (!res.ok) return
      const data = await res.json()
      if (data.running) setStatus('running')
    } catch {
      // ignora — não bloqueia a tela se a checagem de status falhar
    }
  }

  async function handleSelectClient(folder: DriveFolder) {
    // O nome só aparece no log; o caminho a partir da raiz diz qual subpasta foi.
    const name = [...path.slice(1), folder].map((item) => item.name).join(' / ')
    const request = ++sheetsRequestRef.current
    setSelectedClient({ id: folder.id, name })
    setSheets([])
    setSelectedSheets([])
    setSheetsError(null)
    setSheetsState('loading')
    try {
      const res  = await fetch(`/api/automacao/sheets?client_id=${encodeURIComponent(folder.id)}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      if (request !== sheetsRequestRef.current) return
      setSheets(data.sheets)
      setSelectedSheets(data.sheets)
      setSheetsState(data.sheets.length > 0 ? 'ready' : 'empty')
    } catch (e) {
      if (request !== sheetsRequestRef.current) return
      setSheetsError(errorText(e))
      setSheetsState('error')
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
  const filterTerm = filter.trim().toLowerCase()
  const visibleFolders = filterTerm
    ? folders.filter(folder => folder.name.toLowerCase().includes(filterTerm))
    : folders
  // Sem planilha na pasta, ou com todas as abas desmarcadas, não há o que rodar
  // (antes, nenhuma aba marcada rodava a planilha inteira).
  const canRun = Boolean(selectedClient) && status !== 'loading' && sheetsState === 'ready' && selectedSheets.length > 0

  return (
    <div className="mf-workspace flex-1 overflow-auto p-6">
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

          {/* Cliente: navegador das pastas de MERCADO LIVRE */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium text-slate-300">Cliente</span>
              {selectedClient && (
                <span className="min-w-0 truncate text-xs text-emerald-300" title={selectedClient.name}>
                  Escolhido: {selectedClient.name}
                </span>
              )}
            </div>
            {status === 'loading' ? (
              <p className="text-sm text-slate-500">Carregando clientes...</p>
            ) : path.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-white/[0.1] bg-white/[0.03]">
                <nav aria-label="Pasta atual" className="flex min-h-[2.75rem] flex-wrap items-center gap-1 border-b border-white/[0.06] px-3 py-1.5 text-xs">
                  {path.length > 1 && (
                    <button
                      type="button"
                      onClick={() => openFolder(path.slice(0, -1))}
                      title={`Voltar para ${path[path.length - 2].name}`}
                      className="mr-1.5 flex items-center gap-1 rounded-md border border-white/[0.1] bg-white/[0.04] px-2 py-1 font-medium text-slate-300 transition-colors hover:bg-white/[0.08] hover:text-white"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Voltar
                    </button>
                  )}
                  {path.map((folder, index) => (
                    <Fragment key={`${folder.id}-${index}`}>
                      {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-600" />}
                      {index === path.length - 1 ? (
                        <span className="font-semibold text-slate-200">{folder.name}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openFolder(path.slice(0, index + 1))}
                          className="rounded px-1 text-slate-400 transition-colors hover:text-emerald-300"
                        >
                          {folder.name}
                        </button>
                      )}
                    </Fragment>
                  ))}
                </nav>

                <div className="relative border-b border-white/[0.06]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                  <input
                    value={filter}
                    onChange={e => setFilter(e.target.value)}
                    placeholder="Buscar nesta pasta..."
                    aria-label="Buscar nesta pasta"
                    className="w-full bg-transparent py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>

                <div className="max-h-72 overflow-y-auto p-1">
                  {foldersLoading ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">Abrindo pasta...</p>
                  ) : folderError ? (
                    <div className="space-y-2 px-3 py-4 text-center">
                      <p className="text-sm text-red-400">{folderError}</p>
                      <button
                        type="button"
                        onClick={() => openFolder(path)}
                        className="text-xs font-medium text-slate-300 underline-offset-2 hover:underline"
                      >
                        Tentar de novo
                      </button>
                    </div>
                  ) : visibleFolders.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">
                      {filter.trim()
                        ? 'Nenhuma pasta com esse nome aqui.'
                        : path.length > 1 ? 'Esta pasta não tem subpastas.' : 'Nenhum cliente na pasta do Drive.'}
                    </p>
                  ) : visibleFolders.map(folder => {
                    const isSelected = selectedClient?.id === folder.id
                    return (
                      <div
                        key={folder.id}
                        className={`flex items-center rounded-lg transition-colors ${
                          isSelected ? 'bg-emerald-500/15 ring-1 ring-inset ring-emerald-500/30' : 'hover:bg-white/[0.05]'
                        }`}
                      >
                        <button
                          type="button"
                          disabled={isRunning}
                          aria-pressed={isSelected}
                          onClick={() => handleSelectClient(folder)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left text-sm disabled:opacity-50"
                        >
                          <Folder className={`h-4 w-4 shrink-0 ${isSelected ? 'text-emerald-300' : 'text-slate-500'}`} />
                          <span className={`truncate ${isSelected ? 'font-medium text-emerald-200' : 'text-slate-300'}`}>
                            {folder.name}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openFolder([...path, folder])}
                          title="Abrir pasta"
                          aria-label={`Abrir a pasta ${folder.name}`}
                          className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
            {status !== 'loading' && path.length > 0 && (
              <p className="text-xs text-slate-500">Clique no nome para escolher a pasta. A seta entra nela.</p>
            )}
          </div>

          {/* Abas */}
          {selectedClient && sheetsState !== 'idle' && (
            <div className="space-y-2">
              <span className="text-sm font-medium text-slate-300">Abas da planilha</span>
              {sheetsState === 'loading' && <p className="text-sm text-slate-500">Carregando abas...</p>}
              {sheetsState === 'empty' && (
                <p className="text-sm text-amber-300/90">
                  Essa pasta não tem planilha. Escolha a pasta onde a planilha está.
                </p>
              )}
              {sheetsState === 'error' && (
                <p className="text-sm text-red-400">Não foi possível ler a planilha: {sheetsError}</p>
              )}
              {sheetsState === 'ready' && (
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
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            {!isRunning ? (
              <>
                <Button
                  onClick={handleRun}
                  disabled={!canRun}
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
