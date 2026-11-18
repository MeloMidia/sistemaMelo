'use client'

import { useEffect, useRef, useState } from 'react'
import { Pencil } from 'lucide-react'

/**
 * Nome que vira campo de texto ao clicar: Enter ou sair do campo salva, Esc
 * cancela. Nome vazio ou igual ao atual não salva.
 */
export function EditableName({
  label,
  onSave,
  textClassName = 'text-sm font-semibold text-white',
  iconClassName = 'w-3 h-3',
  maxLength,
}: {
  label: string
  onSave: (value: string) => void
  /** Tamanho, peso e cor do texto, iguais no nome e no campo de edição. */
  textClassName?: string
  iconClassName?: string
  maxLength?: number
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [value, setValue] = useState(label)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  function commit() {
    setIsEditing(false)
    const trimmed = value.trim()
    if (trimmed && trimmed !== label) onSave(trimmed)
    else setValue(label)
  }

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        value={value}
        maxLength={maxLength}
        aria-label="Nome"
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit() }
          if (e.key === 'Escape') { setValue(label); setIsEditing(false) }
        }}
        className={`${textClassName} bg-white/[0.06] rounded-md px-1.5 py-0.5 -mx-1.5 outline-none ring-1 ring-white/20 w-full`}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => { setValue(label); setIsEditing(true) }}
      className="group/name flex items-center gap-1.5 text-left min-w-0 max-w-full"
      title="Clique para editar o nome"
    >
      <span className={`${textClassName} truncate`}>{label}</span>
      <Pencil className={`${iconClassName} text-slate-600 opacity-0 group-hover/name:opacity-100 shrink-0 transition-opacity`} />
    </button>
  )
}
