// src/components/crm/whatsapp-settings.tsx
'use client'

import { useState, useEffect } from 'react'
import { Wifi, WifiOff, Loader2, RefreshCw, AlertCircle, Webhook, Check, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useConnection, useQrCode } from '@/hooks/crm-api'

type WebhookStatus = {
  currentUrl: string
  expectedUrl: string
  enabled: boolean
  isCorrect: boolean
}

function WebhookConfig() {
  const [configStatus, setConfigStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [detail, setDetail] = useState<string | null>(null)
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus | null>(null)
  const [loadingStatus, setLoadingStatus] = useState(false)

  async function checkStatus() {
    setLoadingStatus(true)
    try {
      const res = await fetch('/api/crm/webhook/status')
      const data = await res.json()
      if (res.ok) setWebhookStatus(data)
    } catch { /* ignore */ } finally {
      setLoadingStatus(false)
    }
  }

  async function configure() {
    setConfigStatus('loading')
    setDetail(null)
    try {
      const res = await fetch('/api/crm/webhook/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setConfigStatus('error')
        setMessage(data.error ?? `Erro ${res.status}`)
        if (data.detail) setDetail(JSON.stringify(data.detail, null, 2))
      } else {
        setConfigStatus('ok')
        setMessage('Webhook configurado!')
        checkStatus()
      }
    } catch (err) {
      setConfigStatus('error')
      setMessage(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  // Verifica status ao montar
  useEffect(() => { checkStatus() }, [])

  const isCorrect = webhookStatus?.isCorrect && webhookStatus?.enabled

  return (
    <div className="border-t border-white/[0.06] pt-4 mt-2 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
          <Webhook className="w-3 h-3" />
          Sincronização em tempo real
        </span>
        {loadingStatus ? (
          <Loader2 className="w-3 h-3 animate-spin text-slate-600" />
        ) : isCorrect ? (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Ativo
          </span>
        ) : webhookStatus ? (
          <span className="text-[10px] text-amber-400 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> Incorreto
          </span>
        ) : null}
      </div>

      {/* Status atual do webhook */}
      {webhookStatus && (
        <div className={`rounded-lg border px-2.5 py-2 space-y-1 ${isCorrect ? 'bg-emerald-500/5 border-emerald-500/15' : 'bg-amber-500/5 border-amber-500/15'}`}>
          {webhookStatus.currentUrl ? (
            <>
              <p className="text-[10px] text-slate-500">Configurado em Evolution:</p>
              <p className="text-[10px] font-mono break-all text-slate-400">{webhookStatus.currentUrl}</p>
              {!webhookStatus.isCorrect && (
                <>
                  <p className="text-[10px] text-slate-500 mt-1">URL esperada:</p>
                  <p className="text-[10px] font-mono break-all text-emerald-400">{webhookStatus.expectedUrl}</p>
                  <p className="text-[10px] text-amber-400 mt-1">O webhook aponta para URL errada — clique em Reconfigurar.</p>
                </>
              )}
            </>
          ) : (
            <p className="text-[10px] text-amber-400">Webhook não configurado na Evolution API.</p>
          )}
        </div>
      )}

      {configStatus === 'error' && (
        <div className="space-y-1">
          <p className="text-[11px] text-red-400 break-words">{message}</p>
          {detail && (
            <pre className="text-[10px] text-slate-500 bg-white/[0.03] border border-white/[0.06] rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">
              {detail}
            </pre>
          )}
        </div>
      )}

      {configStatus === 'ok' && (
        <p className="text-[11px] text-emerald-400">{message}</p>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={configure}
        disabled={configStatus === 'loading'}
        className="w-full text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer gap-1.5 border border-white/[0.06] text-xs"
      >
        {configStatus === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isCorrect ? (
          <RefreshCw className="w-3.5 h-3.5" />
        ) : (
          <Webhook className="w-3.5 h-3.5" />
        )}
        {isCorrect ? 'Reconfigurar Webhook' : 'Configurar Webhook'}
      </Button>
    </div>
  )
}

export function WhatsappSettings() {
  const [open, setOpen] = useState(false)
  const { data: connection } = useConnection()
  const isConnected = connection?.status === 'open'
  const { data: qrData, isLoading: isLoadingQr, error: qrError, refetch } = useQrCode(open && !isConnected)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer"
          />
        }
      >
        {isConnected ? <Wifi className="w-4 h-4 text-emerald-400" /> : <WifiOff className="w-4 h-4 text-red-400" />}
        WhatsApp
      </DialogTrigger>
      <DialogContent className="bg-[#0a0b10] border-white/[0.1] sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Conexão WhatsApp</DialogTitle>
        </DialogHeader>

        {isConnected ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 text-emerald-400 text-sm py-4 justify-center">
              <Wifi className="w-5 h-5" /> Conectado
            </div>
            <WebhookConfig />
          </div>
        ) : isLoadingQr ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
          </div>
        ) : qrData?.base64 ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <img src={qrData.base64} alt="QR Code WhatsApp" className="w-56 h-56 rounded-xl" />
            <p className="text-xs text-slate-500 text-center">
              Abra o WhatsApp no celular do número dedicado → Configurações → Aparelhos conectados → Conectar um
              aparelho
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 px-4">
            <AlertCircle className="w-8 h-8 text-red-400/70" />
            <p className="text-sm text-slate-400 text-center">
              {qrError?.message ?? 'Não foi possível carregar o QR code.'}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="text-slate-400 hover:text-white cursor-pointer gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
