'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useEventCategories,
  useCreateEventCategory,
  useUpdateEventCategory,
  useDeleteEventCategory,
} from '@/hooks/agenda-api'

interface CategorySidebarProps {
  visibleIds: Set<string>
  onToggle: (id: string) => void
}

export function CategorySidebar({ visibleIds, onToggle }: CategorySidebarProps) {
  const { data: categories } = useEventCategories()
  const createCategory = useCreateEventCategory()
  const updateCategory = useUpdateEventCategory()
  const deleteCategory = useDeleteEventCategory()

  const [isAdding, setIsAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState('#3b82f6')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  function commitRename(id: string, currentName: string) {
    const trimmed = editingName.trim()
    if (trimmed && trimmed !== currentName) updateCategory.mutate({ id, name: trimmed })
    setEditingId(null)
  }

  function handleCreate() {
    if (!newName.trim()) return
    createCategory.mutate(
      { name: newName.trim(), color: newColor },
      {
        onSuccess: () => {
          setNewName('')
          setIsAdding(false)
        },
      }
    )
  }

  return (
    <div className="px-1 mt-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-300">Categorias</span>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="p-1 rounded-md hover:bg-white/[0.06] text-slate-400 hover:text-white cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-1.5">
        {(categories || []).map((category) => (
          <div key={category.id} className="flex items-center gap-2 group">
            <input
              type="checkbox"
              checked={visibleIds.has(category.id)}
              onChange={() => onToggle(category.id)}
              className="w-3.5 h-3.5 rounded cursor-pointer accent-current"
              style={{ accentColor: category.color }}
              aria-label={`Mostrar categoria ${category.name}`}
            />
            <input
              type="color"
              value={category.color}
              onChange={(e) => updateCategory.mutate({ id: category.id, color: e.target.value })}
              className="w-3.5 h-3.5 rounded-full border-0 bg-transparent cursor-pointer shrink-0"
              title="Mudar cor"
              aria-label="Mudar cor"
            />
            {editingId === category.id ? (
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={() => commitRename(category.id, category.name)}
                onKeyDown={(e) => e.key === 'Enter' && commitRename(category.id, category.name)}
                autoFocus
                className="text-xs text-white bg-white/[0.06] border border-white/[0.15] rounded px-1.5 py-0.5 flex-1 outline-none min-w-0"
              />
            ) : (
              <span
                onClick={() => {
                  setEditingId(category.id)
                  setEditingName(category.name)
                }}
                className="text-xs text-slate-300 truncate flex-1 cursor-text hover:text-white"
                title="Clique para renomear"
              >
                {category.name}
              </span>
            )}
            <button
              type="button"
              onClick={() => deleteCategory.mutate(category.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 cursor-pointer shrink-0"
              aria-label="Excluir categoria"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {isAdding && (
        <div className="flex items-center gap-2 mt-2">
          <input
            type="color"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            className="w-6 h-6 rounded-lg border border-white/[0.1] bg-transparent cursor-pointer shrink-0"
          />
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nova categoria..."
            className="flex-1 bg-white/[0.04] border border-white/[0.1] text-white placeholder:text-slate-600 text-xs rounded-lg px-2 py-1 outline-none focus:border-blue-500/50"
          />
          <button
            type="button"
            onClick={handleCreate}
            className="text-xs text-blue-400 hover:text-blue-300 cursor-pointer font-medium shrink-0"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}
