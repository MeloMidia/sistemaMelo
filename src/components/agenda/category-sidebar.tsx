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
    <div className="px-1 select-none">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-bold text-slate-400 tracking-wider uppercase">Categorias</span>
        <button
          type="button"
          onClick={() => setIsAdding(!isAdding)}
          className="p-1.5 rounded-lg border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.06] hover:border-white/10 text-slate-400 hover:text-white transition-all duration-200 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {(categories || []).map((category) => {
          const isVisible = visibleIds.has(category.id)
          return (
            <div key={category.id} className="flex items-center gap-2.5 group py-0.5">
              {/* Custom Checkbox */}
              <div 
                onClick={() => onToggle(category.id)} 
                className="w-4 h-4 rounded-md border flex items-center justify-center cursor-pointer transition-all duration-200 shrink-0"
                style={{ 
                  borderColor: isVisible ? category.color : 'rgba(255,255,255,0.15)',
                  backgroundColor: isVisible ? category.color : 'transparent',
                  boxShadow: isVisible ? `0 0 10px ${category.color}40` : 'none'
                }}
              >
                {isVisible && (
                  <svg className="w-2.5 h-2.5 text-black stroke-[3.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                )}
              </div>

              {/* Custom Color Dot */}
              <div 
                className="relative w-3.5 h-3.5 rounded-full border border-white/20 shrink-0 cursor-pointer overflow-hidden transition-transform duration-200 hover:scale-110" 
                style={{ backgroundColor: category.color }}
              >
                <input
                  type="color"
                  value={category.color}
                  onChange={(e) => updateCategory.mutate({ id: category.id, color: e.target.value })}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
                  title="Mudar cor"
                />
              </div>

              {editingId === category.id ? (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onBlur={() => commitRename(category.id, category.name)}
                  onKeyDown={(e) => e.key === 'Enter' && commitRename(category.id, category.name)}
                  autoFocus
                  className="text-xs text-white bg-white/[0.06] border border-white/[0.15] focus:border-blue-500/50 rounded-lg px-2 py-0.5 flex-1 outline-none min-w-0 transition-colors duration-150"
                />
              ) : (
                <span
                  onClick={() => {
                    setEditingId(category.id)
                    setEditingName(category.name)
                  }}
                  className="text-xs text-slate-300 truncate flex-1 cursor-text hover:text-white transition-colors duration-150"
                  title="Clique para renomear"
                >
                  {category.name}
                </span>
              )}
              
              <button
                type="button"
                onClick={() => deleteCategory.mutate(category.id)}
                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-red-400 cursor-pointer shrink-0 transition-all duration-200"
                aria-label="Excluir categoria"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )
        })}
      </div>

      {isAdding && (
        <div className="flex items-center gap-2 mt-3 p-2 bg-white/[0.02] border border-white/[0.04] rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Custom color dot picker */}
          <div 
            className="relative w-6 h-6 rounded-xl border border-white/10 shrink-0 cursor-pointer overflow-hidden transition-transform duration-150 hover:scale-105" 
            style={{ backgroundColor: newColor }}
          >
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full scale-150"
            />
          </div>
          
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nova categoria..."
            className="flex-1 bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-650 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-500/50 transition-colors duration-200"
          />
          
          <button
            type="button"
            onClick={handleCreate}
            className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-500 active:scale-95 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider cursor-pointer shadow-md transition-all duration-150 shrink-0"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}
