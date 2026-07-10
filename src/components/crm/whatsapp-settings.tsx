// src/components/crm/whatsapp-settings.tsx
'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Loader2, RefreshCw, AlertCircle, Webhook, Check, ExternalLink } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useConnection, useQrCode } from '@/hooks/crm-api'

function WebhookConfig() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')

  async function configure() {
    setStatus('loading')
    try {
      const res = await fetch('/api/crm/webhook/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setStatus('error')
        setMessage(data.error ?? `Erro ${res.status}`)
      } else {
        setStatus('ok')
        setWebhookUrl(data.webhookUrl ?? '')
        setMessage('Webhook configurado com sucesso!')
      }
    } catch (err) {
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Erro desconhecido')
    }
  }

  return (
    <div className="border-t border-white/[0.06] pt-4 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5">
          <Webhook className="w-3 h-3" />
          Sincronização em tempo real
        </span>
        {status === 'ok' && (
          <span className="text-[10px] text-emerald-400 flex items-center gap-1">
            <Check className="w-3 h-3" /> Ativo
          </span>
        )}
      </div>

      <p className="text-[11px] text-slate-600 mb-3 leading-relaxed">
        Configura a Evolution API para enviar mensagens em tempo real para este sistema.
        Clique apenas uma vez — depois toda mensagem nova aparece automaticamente.
      </p>

      {webhookUrl && (
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-2.5 py-1.5 mb-3 flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3 text-slate-500 shrink-0" />
          <span className="text-[10px] text-slate-400 truncate font-mono">{webhookUrl}</span>
        </div>
      )}

      {status === 'error' && (
        <p className="text-[11px] text-red-400 mb-2 break-words">{message}</p>
      )}

      <Button
        size="sm"
        variant="ghost"
        onClick={configure}
        disabled={status === 'loading' || status === 'ok'}
        className="w-full text-slate-400 hover:text-white hover:bg-white/[0.06] cursor-pointer gap-1.5 border border-white/[0.06] text-xs"
      >
        {status === 'loading' ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : status === 'ok' ? (
          <Check className="w-3.5 h-3.5 text-emerald-400" />
        ) : (
          <Webhook className="w-3.5 h-3.5" />
        )}
        {status === 'ok' ? 'Configurado!' : 'Configurar Webhook Automático'}
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
