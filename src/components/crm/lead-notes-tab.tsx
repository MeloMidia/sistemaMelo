'use client'

import { useState } from 'react'
import { Check, Lock, Pencil, StickyNote, X as XIcon } from 'lucide-react'
import { useLeadMessages, useUpdateInternalNote } from '@/hooks/crm-api'

interface LeadNotesTabProps {
  leadId: string
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Notas internas já registradas na conversa (mesmas do modo "Nota Interna" do chat),
 *  reunidas aqui para consulta rápida sem precisar rolar o histórico de mensagens. */
export function LeadNotesTab({ leadId }: LeadNotesTabProps) {
  const { data: messages = [], isLoading } = useLeadMessages(leadId)
  const updateNote = useUpdateInternalNote(leadId)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const notes = messages
    .filter((m) => m.content.startsWith('[Nota Interna]'))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  function startEdit(noteId: string, currentText: string) {
    setEditingNoteId(noteId)
    setEditContent(currentText)
  }

  function cancelEdit() {
    setEditingNoteId(null)
    setEditContent('')
  }

  function saveEdit() {
    if (!editContent.trim() || updateNote.isPending || !editingNoteId) return
    updateNote.mutate(
      { messageId: editingNoteId, content: editContent },
      { onSuccess: () => { setEditingNoteId(null); setEditContent('') } }
    )
  }

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-sm text-slate-500">Carregando anotações…</div>
  }

  if (notes.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="size-14 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center mb-4">
          <StickyNote className="size-7" />
        </div>
        <h2 className="text-base font-semibold text-white">Nenhuma anotação ainda</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-xs">
          Use o modo &quot;Nota Interna&quot; no chat para registrar observações sobre este lead — elas aparecem aqui.
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5">
      {notes.map((note) => {
        const noteText = note.content.replace('[Nota Interna]', '').trim()
        const isEditing = editingNoteId === note.id

        return (
          <div key={note.id} className="mf-chat-note rounded-lg p-3 flex items-start gap-2.5 text-[13px] group/note">
            <div className="mf-chat-note-icon w-6 h-6 rounded flex items-center justify-center shrink-0 mt-0.5">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="mf-chat-note-time text-[9px]">{formatDateTime(note.createdAt)}</span>
                {!isEditing && (
                  <button
                    onClick={() => startEdit(note.id, noteText)}
                    className="mf-chat-note-edit opacity-0 group-hover/note:opacity-100 transition-opacity p-0.5 rounded cursor-pointer"
                    title="Editar nota"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveEdit() }
                      if (e.key === 'Escape') cancelEdit()
                    }}
                    className="mf-chat-note-input w-full rounded-lg px-2.5 py-2 text-[13px] leading-relaxed resize-none outline-none transition-colors"
                    rows={3}
                  />
                  <div className="flex items-center gap-2 justify-end">
                    <button onClick={cancelEdit} className="mf-chat-note-cancel flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] transition-all cursor-pointer">
                      <XIcon className="w-3 h-3" />
                      Cancelar
                    </button>
                    <button
                      onClick={saveEdit}
                      disabled={updateNote.isPending || !editContent.trim()}
                      className="mf-chat-note-save flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-40 transition-all cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      Salvar
                    </button>
                  </div>
                </div>
              ) : (
                <span className="mf-chat-note-copy leading-relaxed text-[13px] text-left whitespace-pre-wrap">{noteText}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
