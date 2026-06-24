'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Smile, Paperclip, Mic, Check, CheckCheck, MessageSquare, Lock, Zap, Clock, RefreshCw, Play, Pause, Square, Trash2 } from 'lucide-react'
import { useLeadMessages, useSendMessage, useSyncLeadMessages, useSendAudioMessage } from '@/hooks/crm-api'

interface LeadConversaTabProps {
  leadId: string
}

const EMOJIS = ['😂', '❤️', '👍', '😍', '🙏', '😭', '😊', '🔥', '👏', '🎉', '🤔', '👀', '🚀', '💡', '❌', '✅', '📞', '💬']

const TEMPLATES = [
  "Olá! Como posso te ajudar hoje?",
  "Olá! Identifiquei seu interesse no nosso anúncio. Qual a melhor hora para conversarmos?",
  "Olá! Sou o consultor de vendas. Seu lead foi qualificado e estou à disposição.",
  "Segue o link para prosseguirmos com seu atendimento: https://wa.me/553399752934",
  "Fico aguardando seu retorno. Qualquer dúvida, estou à disposição!"
]

const whatsappDoodleUrl = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='220' viewBox='0 0 180 220' fill='none'%3E%3Cg fill='%23ffffff' fill-opacity='0.008'%3E%3Cpath d='M15 15h14a2 2 0 012 2v8a2 2 0 01-2 2h-10l-4 4v-4h-2a2 2 0 01-2-2v-8a2 2 0 012-2z' stroke='%23ffffff' stroke-opacity='0.008' stroke-width='1.2' fill='none'/%3E%3Cpath d='M50 25c-2-2-5-2-7 0l-1 1-1-1c-2-2-5-2-7 0-2 2-2 5 0 7l8 8 8-8c2-2 2-5 0-7z' fill='%23ffffff' fill-opacity='0.004'/%3E%3Cpath d='M90 20l2 4 4 1-3 3 1 4-4-2-4 2 1-4-3-3 4-1z' fill='%23ffffff' fill-opacity='0.004'/%3E%3Cpath d='M20 70c2 0 4 2 4 4 0 3-3 6-6 6-4 0-8-4-8-8 0-3 3-6 6-6 2 0 4 2 4 4' stroke='%23ffffff' stroke-opacity='0.008' stroke-width='1.2' fill='none'/%3E%3Cpath d='M90 70v10M90 75a3 3 0 11-3-3' stroke='%23ffffff' stroke-opacity='0.008' stroke-width='1.2' fill='none'/%3E%3Cpath d='M50 75l3 3 6-6' stroke='%23ffffff' stroke-opacity='0.008' stroke-width='1.2' fill='none'/%3E%3C/g%3E%3C/svg%3E`

function MessageAudioPlayer({ messageId, isOutbound }: { messageId: string; isOutbound: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState('0:00')
  const [duration, setDuration] = useState('0:00')

  function togglePlay() {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
  }

  function handleTimeUpdate() {
    if (!audioRef.current) return
    const current = audioRef.current.currentTime
    const dur = audioRef.current.duration || 0
    if (dur > 0) {
      setProgress((current / dur) * 100)
    }
    setCurrentTime(formatTime(current))
  }

  function handleLoadedMetadata() {
    if (!audioRef.current) return
    setDuration(formatTime(audioRef.current.duration))
  }

  function handleAudioEnded() {
    setIsPlaying(false)
    setProgress(0)
    setCurrentTime('0:00')
  }

  function formatTime(seconds: number) {
    if (isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  function handleProgressBarClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    const percentage = clickX / width
    audioRef.current.currentTime = percentage * audioRef.current.duration
  }

  return (
    <div className="flex items-center gap-3 py-1.5 min-w-[240px] select-none">
      <button
        type="button"
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
          isOutbound
            ? 'bg-emerald-600/30 text-emerald-400 hover:bg-emerald-600/50'
            : 'bg-[#00a884]/20 text-[#00a884] hover:bg-[#00a884]/30'
        }`}
      >
        {isPlaying ? (
          <Pause className="w-4 h-4 fill-current" />
        ) : (
          <Play className="w-4 h-4 fill-current ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        <div 
          onClick={handleProgressBarClick}
          className="h-1 rounded-full cursor-pointer relative flex items-center group w-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
        >
          <div 
            className={`h-full rounded-full ${isOutbound ? 'bg-emerald-400' : 'bg-[#00a884]'}`}
            style={{ width: `${progress}%` }}
          />
          <div 
            className={`absolute w-2.5 h-2.5 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity duration-150 ${
              isOutbound ? 'bg-emerald-400' : 'bg-[#00a884]'
            }`}
            style={{ left: `calc(${progress}% - 5px)` }}
          />
        </div>

        <div className="flex justify-between text-[10px] text-slate-400 font-medium">
          <span>{currentTime}</span>
          <span>{duration}</span>
        </div>
      </div>

      <div className="flex items-center pr-1 shrink-0">
        <Mic className={`w-5 h-5 ${isOutbound ? 'text-emerald-400' : 'text-[#00a884]'}`} />
      </div>

      <audio
        ref={audioRef}
        src={`/api/crm/messages/${messageId}/media`}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleAudioEnded}
        className="hidden"
        preload="metadata"
      />
    </div>
  )
}

function MessageImagePreview({ messageId }: { messageId: string }) {
  const [hasError, setHasError] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  if (hasError) {
    return (
      <div className="text-slate-400 text-xs italic py-2 flex items-center gap-2">
        <span>🖼️ Erro ao carregar imagem</span>
      </div>
    )
  }

  return (
    <div className="relative rounded-lg overflow-hidden max-w-[280px] border border-white/5 bg-[#182229]/50 mt-1">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50">
          <div className="w-6 h-6 border-2 border-[#00a884] border-t-transparent rounded-full animate-spin" />
        </div>
      )}
      <img
        src={`/api/crm/messages/${messageId}/media`}
        alt="WhatsApp Mídia"
        onLoad={() => setIsLoading(false)}
        onError={() => setHasError(true)}
        className="w-full h-auto object-cover max-h-[220px] transition-all hover:scale-105 duration-200 cursor-pointer"
        onClick={() => window.open(`/api/crm/messages/${messageId}/media`, '_blank')}
      />
    </div>
  )
}

function MessageDocumentPreview({ messageId, content }: { messageId: string; content: string }) {
  return (
    <a
      href={`/api/crm/messages/${messageId}/media`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-[#182229] border border-white/5 rounded-lg p-2.5 mt-1 hover:bg-[#202c33] transition-colors max-w-[280px]"
    >
      <div className="w-9 h-9 bg-emerald-600/10 rounded flex items-center justify-center shrink-0 text-emerald-400 text-lg">
        📄
      </div>
      <div className="flex-1 flex flex-col overflow-hidden text-[11px] leading-tight text-left">
        <span className="font-semibold text-white truncate text-xs">Documento WhatsApp</span>
        <span className="text-slate-400 truncate mt-0.5">Clique para fazer download</span>
      </div>
    </a>
  )
}

export function LeadConversaTab({ leadId }: LeadConversaTabProps) {
  const { data: messages } = useLeadMessages(leadId)
  const sendMessage = useSendMessage(leadId)
  const syncMessages = useSyncLeadMessages()

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

  const [draft, setDraft] = useState('')
  const [activeMode, setActiveMode] = useState<'responder' | 'nota'>('responder')
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showAttachMenu, setShowAttachMenu] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-sync messages silently when component mounts or leadId changes
  useEffect(() => {
    if (leadId) {
      syncMessages.mutate(leadId)
    }
  }, [leadId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false)
        setShowAttachMenu(false)
        setShowTemplates(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      mediaRecorderRef.current?.stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  function handleSend() {
    if (!draft.trim() || sendMessage.isPending) return
    
    // Prefix note text if in Note Interna mode
    const contentToSend = activeMode === 'nota' ? `[Nota Interna] ${draft.trim()}` : draft.trim()
    sendMessage.mutate(contentToSend)
    
    setDraft('')
    setShowEmojiPicker(false)
    setShowTemplates(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleAddEmoji(emoji: string) {
    setDraft((prev) => prev + emoji)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleApplyTemplate(template: string) {
    setDraft(template)
    setShowTemplates(false)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    sendMessage.mutate(`📁 Arquivo enviado: ${file.name}`)
    setShowAttachMenu(false)
  }

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

  function formatTime(dateString: string) {
    try {
      const date = new Date(dateString)
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      return ''
    }
  }

  function getDateLabel(dateKey: string) {
    const date = new Date(dateKey)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (date.toDateString() === today.toDateString()) {
      return 'HOJE'
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'ONTEM'
    } else {
      return date.toLocaleDateString('pt-BR')
    }
  }

  function renderStatusTicks(status: string | null) {
    if (status === 'SENT') {
      return (
        <svg viewBox="0 0 16 11" width="16" height="11" className="fill-current text-slate-400 w-3.5 h-3 inline">
          <path d="M15 1.2l-9.5 9.5-4.5-4.5 1.4-1.4 3.1 3.1 8.1-8.1 1.4 1.4z"/>
        </svg>
      )
    }
    if (status === 'DELIVERED') {
      return (
        <svg viewBox="0 0 18 11" width="18" height="11" className="fill-current text-slate-400 w-4 h-3 inline">
          <path d="M12.5 1.2l-9.5 9.5-4.5-4.5 1.4-1.4 3.1 3.1 8.1-8.1 1.4 1.4zm2.5 1.4L9.5 8.1 8.1 6.7l-1.4 1.4 2.8 2.8 6.9-6.9-1.4-1.4zm3-2.8L11.1 6.7l1.4 1.4 5.5-5.5-1.4-1.4z"/>
        </svg>
      )
    }
    if (status === 'READ') {
      return (
        <svg viewBox="0 0 18 11" width="18" height="11" className="fill-current text-[#53bdeb] w-4 h-3 inline">
          <path d="M12.5 1.2l-9.5 9.5-4.5-4.5 1.4-1.4 3.1 3.1 8.1-8.1 1.4 1.4zm2.5 1.4L9.5 8.1 8.1 6.7l-1.4 1.4 2.8 2.8 6.9-6.9-1.4-1.4zm3-2.8L11.1 6.7l1.4 1.4 5.5-5.5-1.4-1.4z"/>
        </svg>
      )
    }
    if (status === 'FAILED') {
      return <span className="text-[10px] text-red-500 font-bold">!</span>
    }
    // Default to single tick
    return (
      <svg viewBox="0 0 16 11" width="16" height="11" className="fill-current text-slate-400 w-3.5 h-3 inline">
        <path d="M15 1.2l-9.5 9.5-4.5-4.5 1.4-1.4 3.1 3.1 8.1-8.1 1.4 1.4z"/>
      </svg>
    )
  }

  function renderMessageContent(content: string, messageId: string, isOutbound: boolean) {
    if (content.includes('tipo: áudio')) {
      return <MessageAudioPlayer messageId={messageId} isOutbound={isOutbound} />
    }
    if (content.includes('tipo: imagem')) {
      return <MessageImagePreview messageId={messageId} />
    }
    if (content.includes('tipo: documento')) {
      return <MessageDocumentPreview messageId={messageId} content={content} />
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g
    const hasUrl = urlRegex.test(content)
    
    if (hasUrl) {
      const urls = content.match(urlRegex)
      const primaryUrl = urls ? urls[0] : ''
      const textWithoutUrl = content.replace(primaryUrl, '').trim()
      
      return (
        <div className="flex flex-col gap-2 w-full">
          {textWithoutUrl && <div className="text-[14.2px] leading-[19px] whitespace-pre-wrap">{textWithoutUrl}</div>}
          {primaryUrl.includes('wa.me') || primaryUrl.includes('whatsapp.com') ? (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#07251d] border border-white/5 rounded-lg p-2.5 mt-1 hover:bg-[#093026] transition-colors"
            >
              <div className="w-10 h-10 bg-white rounded flex items-center justify-center shrink-0">
                <svg viewBox="0 0 24 24" className="w-7 h-7 text-[#25D366] fill-current">
                  <path d="M12.012 2c-5.506 0-9.988 4.493-9.988 10.013 0 1.76.459 3.475 1.333 4.994L2 22l5.144-1.353a9.929 9.929 0 004.868 1.272c5.506 0 9.988-4.492 9.988-10.013S17.518 2 12.012 2zm6.059 14.152c-.249.704-1.246 1.282-1.722 1.343-.454.059-.92.091-2.909-.731-2.544-1.052-4.18-3.642-4.307-3.812-.127-.17-1.042-1.39-1.042-2.651 0-1.261.657-1.881.89-2.13.23-.249.51-.31.68-.31.17 0 .34 0 .488.006.155.006.363-.058.568.444.21.517.72 1.76.782 1.886.063.127.104.275.02.444-.083.17-.125.275-.249.424-.125.149-.262.333-.374.448-.125.127-.255.265-.11.517.145.249.645 1.07 1.38 1.726.949.845 1.745 1.107 1.993 1.23.249.127.393.107.539-.063.145-.17.621-.722.787-.968.165-.246.33-.207.558-.122.23.085 1.455.688 1.703.812.249.125.414.186.474.292.063.107.063.618-.186 1.322z"/>
                </svg>
              </div>
              <div className="flex-1 flex flex-col overflow-hidden text-[11px] leading-tight text-left">
                <span className="font-semibold text-white truncate text-xs">Compartilhe no WhatsApp</span>
                <span className="text-slate-400 line-clamp-2 mt-0.5">WhatsApp Messenger: mais de dois bilhões de pessoas, em mais de 180 países, usam o WhatsApp para manter o contato com amigos e...</span>
                <span className="text-[#53bdeb] truncate mt-1">{primaryUrl}</span>
              </div>
            </a>
          ) : (
            <a
              href={primaryUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-[#1d2327] border border-white/5 rounded-lg p-2.5 mt-1 hover:bg-[#262e33] transition-colors"
            >
              <div className="w-10 h-10 bg-slate-700 rounded flex items-center justify-center shrink-0 text-white font-bold text-xs uppercase">
                Link
              </div>
              <div className="flex-1 flex flex-col overflow-hidden text-[11px] leading-tight text-left">
                <span className="font-semibold text-white truncate text-xs">{primaryUrl}</span>
                <span className="text-slate-400 truncate mt-0.5">Clique para abrir o link externo</span>
              </div>
            </a>
          )}
        </div>
      )
    }
    return <div className="text-[14.2px] leading-[19px] whitespace-pre-wrap">{content}</div>
  }

  // Group messages
  const msgList = messages || []
  const dateGroups: { [key: string]: typeof msgList } = {}
  msgList.forEach((m) => {
    const dateStr = new Date(m.createdAt).toDateString()
    if (!dateGroups[dateStr]) dateGroups[dateStr] = []
    dateGroups[dateStr].push(m)
  })

  const sortedDateKeys = Object.keys(dateGroups).sort((a, b) => {
    return new Date(a).getTime() - new Date(b).getTime()
  })

  return (
    <div ref={containerRef} className="flex-1 flex flex-col h-full relative overflow-hidden select-none bg-[#111416]">
      {/* Messages list */}
      <div
        className="flex-1 overflow-y-auto p-4 relative flex flex-col"
        style={{
          backgroundColor: '#111416',
          backgroundImage: `url("${whatsappDoodleUrl}")`,
          backgroundSize: '180px 220px',
          backgroundRepeat: 'repeat',
        }}
      >
        {sortedDateKeys.map((dateKey) => {
          const groupMessages = dateGroups[dateKey]
          return (
            <div key={dateKey} className="flex flex-col w-full">
              {/* Date divider */}
              <div className="flex justify-center my-3">
                <span className="bg-[#1e2225] text-slate-400 text-[10px] font-semibold py-1 px-3 rounded-[6px] tracking-wider uppercase shadow-sm">
                  {getDateLabel(dateKey)}
                </span>
              </div>

              {/* Group messages list */}
              {groupMessages.map((m, index) => {
                // If it is an internal note, render it inside a yellow-ish note block
                if (m.content.startsWith('[Nota Interna]')) {
                  const noteText = m.content.replace('[Nota Interna]', '').trim()
                  return (
                    <div key={m.id} className="flex justify-center my-2 w-full px-2">
                      <div className="bg-[#241e12] border border-[#d6a132]/25 rounded-lg p-3 max-w-[95%] w-full flex items-start gap-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.2)] text-[13px] animate-in fade-in slide-in-from-bottom-1 duration-150">
                        <div className="w-6 h-6 rounded bg-[#d6a132]/15 flex items-center justify-center text-[#d6a132] shrink-0">
                          <Lock className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[#d6a132] font-semibold text-xs tracking-wider uppercase">Nota Interna</span>
                            <span className="text-[9px] text-[#d6a132]/60">{formatTime(m.createdAt)}</span>
                          </div>
                          <span className="text-[#f1d28c] leading-relaxed text-[13px] text-left">{noteText}</span>
                        </div>
                      </div>
                    </div>
                  )
                }

                const isOutbound = m.direction === 'OUTBOUND'
                const isFirst = index === 0 || groupMessages[index - 1].direction !== m.direction || groupMessages[index - 1].content.startsWith('[Nota Interna]')
                const isLast = index === groupMessages.length - 1 || groupMessages[index + 1].direction !== m.direction || groupMessages[index + 1].content.startsWith('[Nota Interna]')
                
                const marginTop = index === 0 ? 'mt-2' : (groupMessages[index - 1].direction === m.direction && !groupMessages[index - 1].content.startsWith('[Nota Interna]')) ? 'mt-[2px]' : 'mt-2.5'
                const paddingBottom = isLast ? 'mb-2' : ''

                return (
                  <div
                    key={m.id}
                    className={`flex w-full ${isOutbound ? 'justify-end' : 'justify-start'} ${marginTop} ${paddingBottom}`}
                  >
                    <div
                      className={`relative max-w-[85%] px-3 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.15)] break-words flex flex-col ${
                        isOutbound
                          ? `bg-[#0b3d2f] text-[#e9edef] ${isFirst ? 'rounded-lg rounded-tr-none' : 'rounded-lg'}`
                          : `bg-[#202c33] text-[#e9edef] ${isFirst ? 'rounded-lg rounded-tl-none' : 'rounded-lg'}`
                      }`}
                    >
                      {/* Tail SVG */}
                      {isFirst && isOutbound && (
                        <svg className="absolute top-0 right-[-8px] w-[8px] h-[13px] text-[#0b3d2f] fill-current" viewBox="0 0 8 13">
                          <path fill="currentColor" d="M1.533 3.568 8 12.193V0H2.812C1.042 0 .474 1.156 1.533 3.568z"/>
                        </svg>
                      )}
                      {isFirst && !isOutbound && (
                        <svg className="absolute top-0 left-[-8px] w-[8px] h-[13px] text-[#202c33] fill-current" viewBox="0 0 8 13">
                          <path fill="currentColor" d="M6.467 3.568 0 12.193V0h5.188C6.958 0 7.526 1.156 6.467 3.568z"/>
                        </svg>
                      )}

                      {/* Message Content */}
                      <div className="pr-4 text-left">
                        {renderMessageContent(m.content, m.id, isOutbound)}
                      </div>

                      {/* Timestamp & Ticks inside bubble (bottom right style) */}
                      <div className="flex items-center gap-1 self-end mt-1 select-none h-3 pointer-events-none">
                        <span className="text-[9px] text-[#aebac1]/60 font-normal leading-none">
                          {formatTime(m.createdAt)}
                        </span>
                        {isOutbound && (
                          <span className="inline-flex shrink-0">
                            {renderStatusTicks(m.status)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Mode selectors (Responder / Nota Interna) + Sync Button */}
      <div className="flex gap-4 px-4 py-1.5 bg-[#121517] border-t border-white/[0.04] text-[11px] items-center justify-between">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveMode('responder')}
            className={`flex items-center gap-1.5 py-1 font-semibold transition-colors duration-150 relative cursor-pointer ${
              activeMode === 'responder' ? 'text-[#00a884]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Responder</span>
            {activeMode === 'responder' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#00a884] rounded" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveMode('nota')}
            className={`flex items-center gap-1.5 py-1 font-semibold transition-colors duration-150 relative cursor-pointer ${
              activeMode === 'nota' ? 'text-[#e2a03f]' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Nota Interna</span>
            {activeMode === 'nota' && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#e2a03f] rounded" />
            )}
          </button>
        </div>

        {/* Sync Button */}
        <button
          type="button"
          onClick={() => syncMessages.mutate(leadId)}
          disabled={syncMessages.isPending}
          className="text-xs text-[#00a884] hover:text-[#009675] disabled:text-slate-500 font-semibold cursor-pointer transition-colors flex items-center gap-1 shrink-0 select-none"
          title="Sincronizar histórico de mensagens com o WhatsApp"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncMessages.isPending ? 'animate-spin' : ''}`} />
          <span>{syncMessages.isPending ? 'Sincronizando...' : 'Sincronizar'}</span>
        </button>
      </div>

      {/* Emoji Picker Popover */}
      {showEmojiPicker && (
        <div className="absolute bottom-[110px] left-[16px] bg-[#233138] border border-white/[0.08] rounded-lg shadow-2xl p-2.5 z-50 w-[240px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="grid grid-cols-6 gap-1.5">
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleAddEmoji(emoji)}
                className="text-lg p-1 hover:bg-[#182229] rounded transition-colors duration-100 cursor-pointer text-center select-none"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Attachment Menu Popover */}
      {showAttachMenu && (
        <div className="absolute bottom-[110px] left-[48px] bg-[#233138] border border-white/[0.08] rounded-lg shadow-2xl p-1 z-50 flex flex-col w-[160px] animate-in fade-in slide-in-from-bottom-2 duration-150">
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false)
              fileInputRef.current?.click()
            }}
            className="flex items-center gap-3 px-3.5 py-2.5 text-xs text-[#e9edef] hover:bg-[#182229] rounded transition-colors duration-100 cursor-pointer text-left"
          >
            <span className="text-[#00a884]">📄</span> Documento
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false)
              fileInputRef.current?.click()
            }}
            className="flex items-center gap-3 px-3.5 py-2.5 text-xs text-[#e9edef] hover:bg-[#182229] rounded transition-colors duration-100 cursor-pointer text-left"
          >
            <span className="text-[#007bfc]">🖼️</span> Fotos e Vídeos
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false)
              alert('Função câmera não suportada no seu dispositivo')
            }}
            className="flex items-center gap-3 px-3.5 py-2.5 text-xs text-[#e9edef] hover:bg-[#182229] rounded transition-colors duration-100 cursor-pointer text-left"
          >
            <span className="text-[#ff2e74]">📷</span> Câmera
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAttachMenu(false)
              alert('Integração de contatos indisponível')
            }}
            className="flex items-center gap-3 px-3.5 py-2.5 text-xs text-[#e9edef] hover:bg-[#182229] rounded transition-colors duration-100 cursor-pointer text-left"
          >
            <span className="text-[#009688]">👤</span> Contato
          </button>
        </div>
      )}

      {/* Templates Selector Popover */}
      {showTemplates && (
        <div className="absolute bottom-[110px] left-[16px] bg-[#233138] border border-white/[0.08] rounded-lg shadow-2xl p-1.5 z-50 flex flex-col w-[320px] max-h-[220px] overflow-y-auto animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="text-[10px] text-slate-400 font-semibold px-3 py-1.5 uppercase tracking-wider border-b border-white/[0.05] mb-1">
            Respostas Rápidas
          </div>
          {TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyTemplate(tmpl)}
              className="px-3 py-2 text-xs text-[#e9edef] hover:bg-[#182229] rounded transition-colors duration-100 cursor-pointer text-left truncate"
            >
              {tmpl}
            </button>
          ))}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Composing Input area */}
      <div className="p-3 bg-[#121517] flex gap-3 items-end border-t border-white/[0.04] select-none relative">
        {/* Composing text card */}
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

        {/* Floating Action Button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={sendMessage.isPending}
          className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-lg transition-all duration-200 cursor-pointer ${
            activeMode === 'responder'
              ? 'bg-[#00a884] hover:bg-[#009675] text-white'
              : 'bg-[#e2a03f] hover:bg-[#c98629] text-white'
          } disabled:opacity-50`}
        >
          {draft.trim() ? (
            <Send className="w-5 h-5 fill-current ml-0.5" />
          ) : (
            <Mic className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  )
}
