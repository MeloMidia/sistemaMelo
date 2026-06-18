'use client'

import React, { useState } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import { upsertSdrLog, getSdrLogByDate, type SdrLogData } from '@/app/actions/sdr'

interface SdrLaunchModalProps {
  onSuccess: () => void
}

const EMPTY_FORM = {
  leadsWhatsapp: '',
  agendadas: '',
  realizadas: '',
  faltaLead: '',
  naoRealizada: '',
}

const FIELDS: { name: keyof typeof EMPTY_FORM; label: string; color: 'blue' | 'red'; colSpan?: boolean }[] = [
  { name: 'leadsWhatsapp', label: 'Leads WhatsApp', color: 'blue' },
  { name: 'agendadas', label: 'Agendadas', color: 'blue' },
  { name: 'realizadas', label: 'Realizadas', color: 'blue' },
  { name: 'faltaLead', label: 'Falta — lead', color: 'red' },
  { name: 'naoRealizada', label: 'Não realizada', color: 'red', colSpan: true },
]

function toDateInputValue(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function parseDateInput(str: string): Date {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function SdrLaunchModal({ onSuccess }: SdrLaunchModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [form, setForm] = useState<typeof EMPTY_FORM>({ ...EMPTY_FORM })
  const [selectedDate, setSelectedDate] = useState(toDateInputValue(new Date()))

  const fetchLogForDate = async (dateStr: string) => {
    setIsFetching(true)
    try {
      const existing = await getSdrLogByDate(parseDateInput(dateStr))
      if (existing) {
        setForm({
          leadsWhatsapp: String(existing.leadsWhatsapp),
          agendadas: String(existing.agendadas),
          realizadas: String(existing.realizadas),
          faltaLead: String(existing.faltaLead),
          naoRealizada: String(existing.naoRealizada),
        })
      } else {
        setForm({ ...EMPTY_FORM })
      }
    } finally {
      setIsFetching(false)
    }
  }

  const open = async () => {
    const today = toDateInputValue(new Date())
    setSelectedDate(today)
    setIsOpen(true)
    await fetchLogForDate(today)
  }

  const close = () => {
    setIsOpen(false)
    setForm({ ...EMPTY_FORM })
  }

  const handleDateChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSelectedDate(val)
    if (val) await fetchLogForDate(val)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '')
    setForm(prev => ({ ...prev, [e.target.name]: raw }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedDate) return
    setIsLoading(true)
    try {
      const data: SdrLogData = {
        leadsWhatsapp: Number(form.leadsWhatsapp || 0),
        agendadas: Number(form.agendadas || 0),
        realizadas: Number(form.realizadas || 0),
        faltaLead: Number(form.faltaLead || 0),
        naoRealizada: Number(form.naoRealizada || 0),
      }
      await upsertSdrLog(parseDateInput(selectedDate), data)
      close()
      onSuccess()
    } catch (error) {
      console.error(error)
      alert('Erro ao salvar lançamento.')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={open}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-lg text-sm font-semibold transition-all shadow-lg shadow-indigo-500/25 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Lançar dia
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#07080c]/80 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) close() }}
    >
      <div className="bg-[#0f111a] border border-white/10 w-full max-w-md rounded-2xl shadow-2xl relative overflow-hidden">
        <div className="flex justify-between items-start p-6 border-b border-white/5">
          <div>
            <h2 className="text-xl font-semibold text-white tracking-tight">Lançamento do dia</h2>
            <p className="text-xs text-slate-500 mt-1">Selecione a data do lançamento</p>
          </div>
          <button onClick={close} className="text-slate-400 hover:text-white transition-colors cursor-pointer mt-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pt-5">
          <label className="text-xs font-medium text-slate-400 mb-1.5 block">Data</label>
          <input
            type="date"
            value={selectedDate}
            max={toDateInputValue(new Date())}
            onChange={handleDateChange}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          />
        </div>

        {isFetching ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-indigo-400" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.map(field => (
                <div key={field.name} className={field.colSpan ? 'col-span-2' : ''}>
                  <label
                    className={`text-xs font-medium mb-1.5 block ${
                      field.color === 'red' ? 'text-red-400' : 'text-indigo-400'
                    }`}
                  >
                    {field.label}
                  </label>
                  <input
                    type="text"
                    name={field.name}
                    value={form[field.name]}
                    onChange={handleChange}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-white text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar lançamento'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
