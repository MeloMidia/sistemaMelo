'use client'

import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import {
  useEventCategories,
  useCreateEventCategory,
  useUpdateEventCategory,
  useDeleteEventCategory,
} from '@/hooks/agenda-api'

const PRESET_COLORS = [
  '#0055ff', // Azul bem forte
  '#ff2222', // Vermelho
  '#00cc44', // Verde
  '#ffbb00', // Amarelo
  '#ff6600', // Laranja
  '#9933ff', // Roxo
  '#ff007f', // Rosa
  '#00cccc', // Ciano
  '#cbd5e1', // Prata
  '#6366f1', // Indigo
  '#14b8a6', // Teal
  '#94a3b8', // Slate
]

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
  const [activePickerId, setActivePickerId] = useState<string | null>(null)

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
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setActivePickerId(activePickerId === category.id ? null : category.id)}
                  className="w-3.5 h-3.5 rounded-full border border-white/20 cursor-pointer transition-transform duration-200 hover:scale-110 focus:outline-none"
                  style={{ backgroundColor: category.color }}
                  title="Mudar cor"
                />
                
                {activePickerId === category.id && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 cursor-default" 
                      onClick={() => setActivePickerId(null)}
                    />
                    <div className="absolute left-0 top-6 z-50 p-2 bg-[#09090b] border border-white/[0.08] rounded-xl shadow-xl shadow-black/50 w-[112px] animate-in fade-in slide-in-from-top-1 duration-150">
                      <div className="grid grid-cols-4 gap-1.5">
                        {PRESET_COLORS.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              updateCategory.mutate({ id: category.id, color })
                              setActivePickerId(null)
                            }}
                            className="w-5 h-5 rounded-md border border-white/10 hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer flex items-center justify-center"
                            style={{ backgroundColor: color }}
                          >
                            {category.color === color && (
                              <div className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
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
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setActivePickerId(activePickerId === 'new' ? null : 'new')}
              className="w-6 h-6 rounded-xl border border-white/10 cursor-pointer transition-transform duration-150 hover:scale-105 focus:outline-none"
              style={{ backgroundColor: newColor }}
            />
            
            {activePickerId === 'new' && (
              <>
                <div 
                  className="fixed inset-0 z-40 cursor-default" 
                  onClick={() => setActivePickerId(null)}
                />
                <div className="absolute left-0 bottom-8 z-50 p-2 bg-[#09090b] border border-white/[0.08] rounded-xl shadow-xl shadow-black/50 w-[112px] animate-in fade-in slide-in-from-bottom-1 duration-150">
                  <div className="grid grid-cols-4 gap-1.5">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => {
                          setNewColor(color)
                          setActivePickerId(null)
                        }}
                        className="w-5 h-5 rounded-md border border-white/10 hover:scale-110 active:scale-95 transition-all duration-150 cursor-pointer flex items-center justify-center"
                        style={{ backgroundColor: color }}
                      >
                        {newColor === color && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white mix-blend-difference" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
          
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            placeholder="Nova categoria..."
            className="flex-1 min-w-0 bg-white/[0.04] border border-white/[0.08] text-white placeholder:text-slate-650 text-xs rounded-xl px-2.5 py-1.5 outline-none focus:border-blue-500/50 transition-colors duration-200"
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
