// src/components/crm/whatsapp-settings.tsx
'use client'

import { useState } from 'react'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useConnection, useQrCode } from '@/hooks/crm-api'

export function WhatsappSettings() {
  const [open, setOpen] = useState(false)
  const { data: connection } = useConnection()
  const isConnected = connection?.status === 'open'
  const { data: qrData, isLoading: isLoadingQr } = useQrCode(open && !isConnected)

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
          <div className="flex items-center gap-2 text-emerald-400 text-sm py-6 justify-center">
            <Wifi className="w-5 h-5" /> Conectado
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
          <p className="text-sm text-slate-500 text-center py-6">Não foi possível carregar o QR code.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
