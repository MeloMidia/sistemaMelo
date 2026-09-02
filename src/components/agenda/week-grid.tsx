'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { addDays, isSameDay, WEEKDAY_LABELS, HOURS, formatHourLabel } from '@/lib/agenda-date'
import type { AgendaEvent } from '@/types/agenda'

const HOUR_HEIGHT = 48
const TIME_COLUMN_WIDTH = 65
const MIN_EVENT_HEIGHT = 22
const GRID_START_HOUR = HOURS[0]          // 7
const GRID_OFFSET_MIN = GRID_START_HOUR * 60
const SNAP_MIN = 15
const MIN_DRAG_PX = 5                      // threshold click vs drag

interface WeekGridProps {
  weekStart: Date
  events: AgendaEvent[]
  onCreateAt: (date: Date, hour: number) => void
  onEditEvent: (event: AgendaEvent) => void
  onUpdateEvent: (id: string, startsAt: string, endsAt: string) => void
  onOpenLeadInCrm?: (leadId: string) => void
}

interface PositionedEvent {
  event: AgendaEvent
  column: number
  columnCount: number
}

function layoutDayEvents(dayEvents: AgendaEvent[]): PositionedEvent[] {
  const sorted = [...dayEvents].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  )
  const columns: AgendaEvent[][] = []
  const placement = new Map<string, number>()

  for (const event of sorted) {
    const start = new Date(event.startsAt).getTime()
    let placed = false
    for (let i = 0; i < columns.length; i++) {
      const last = columns[i][columns[i].length - 1]
      if (start >= new Date(last.endsAt).getTime()) {
        columns[i].push(event)
        placement.set(event.id, i)
        placed = true
        break
      }
    }
    if (!placed) {
      columns.push([event])
      placement.set(event.id, columns.length - 1)
    }
  }

  return sorted.map((event) => {
    const s = new Date(event.startsAt).getTime()
    const e = new Date(event.endsAt).getTime()
    let overlaps = 1
    for (const o of sorted) {
      if (o.id === event.id) continue
      const os = new Date(o.startsAt).getTime()
      const oe = new Date(o.endsAt).getTime()
      if (os < e && oe > s) overlaps++
    }
    return { event, column: placement.get(event.id) ?? 0, columnCount: overlaps }
  })
}

function mfm(d: Date) { return d.getHours() * 60 + d.getMinutes() }
function snapTo(m: number) { return Math.round(m / SNAP_MIN) * SNAP_MIN }
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }
function fmt(d: Date) { return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }

// Cria um elemento ghost no body — posicionamento fixed, sem interagir com React
function spawnGhost(rect: DOMRect, color: string, title: string, time: string): HTMLDivElement {
  const el = document.createElement('div')
  el.style.cssText = [
    'position:fixed',
    `top:${rect.top}px`,
    `left:${rect.left}px`,
    `width:${rect.width}px`,
    `height:${rect.height}px`,
    `background:${color}`,
    'border-radius:8px',
    'border:2px solid rgba(255,255,255,0.6)',
    `box-shadow:0 12px 40px rgba(0,0,0,0.55),0 0 24px ${color}50`,
    'pointer-events:none',
    'z-index:9999',
    'padding:6px 10px',
    'overflow:hidden',
    'will-change:transform',
    'transition:none',
  ].join(';')
  el.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:white;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.3;">${title}</div>
    <div data-ghost-time style="font-size:9px;color:rgba(255,255,255,0.72);font-weight:600;margin-top:2px;line-height:1;">${time}</div>
  `
  document.body.appendChild(el)
  return el
}

type MoveSnap = { dayIdx: number; startMin: number; endMin: number } | null

export function WeekGrid({ weekStart, events, onCreateAt, onEditEvent, onUpdateEvent }: WeekGridProps) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])
  const [now, setNow] = useState(() => new Date())
  const today = now
  const nowMin = mfm(now)
  const gridEndMin = GRID_OFFSET_MIN + HOURS.length * 60
  const showNowIndicator = nowMin >= GRID_OFFSET_MIN && nowMin < gridEndMin
  const nowIndicatorTop = ((nowMin - GRID_OFFSET_MIN) / 60) * HOUR_HEIGHT

  const scrollRef  = useRef<HTMLDivElement>(null)
  const headerRef  = useRef<HTMLDivElement>(null)
  const eventRefs  = useRef<Map<string, HTMLDivElement>>(new Map())

  // Única state React durante o drag: indica qual slot está sendo alvo (move)
  const [moveSnap, setMoveSnap] = useState<MoveSnap>(null)

  useEffect(() => {
    let interval: number | null = null
    const updateNow = () => setNow(new Date())
    const timeout = window.setTimeout(() => {
      updateNow()
      interval = window.setInterval(updateNow, 60_000)
    }, Math.max(1000, 60_000 - (Date.now() % 60_000)))

    return () => {
      window.clearTimeout(timeout)
      if (interval) window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const scroller = scrollRef.current
    const header = headerRef.current
    if (!scroller || !header) return

    const current = new Date()
    const currentDayIndex = days.findIndex((day) => isSameDay(day, current))
    const targetDayIndex = currentDayIndex >= 0 ? currentDayIndex : 0
    const contentWidth = header.scrollWidth || scroller.scrollWidth || scroller.offsetWidth
    const columnWidth = Math.max(0, (contentWidth - TIME_COLUMN_WIDTH) / 7)
    const targetLeft = contentWidth > scroller.clientWidth
      ? Math.max(0, TIME_COLUMN_WIDTH + targetDayIndex * columnWidth - (scroller.clientWidth - columnWidth) / 2)
      : 0

    const currentMin = mfm(current)
    const shouldCenterNow = currentDayIndex >= 0 && currentMin >= GRID_OFFSET_MIN && currentMin < gridEndMin
    const targetTop = shouldCenterNow
      ? Math.max(0, ((currentMin - GRID_OFFSET_MIN) / 60) * HOUR_HEIGHT - scroller.clientHeight * 0.32)
      : scroller.scrollTop

    requestAnimationFrame(() => {
      scroller.scrollTo({ left: targetLeft, top: targetTop, behavior: 'smooth' })
    })
  }, [days, gridEndMin, weekStart])

  const getMetrics = useCallback(() => {
    const s = scrollRef.current
    const h = headerRef.current
    if (!s || !h) return null
    return {
      rect:      s.getBoundingClientRect(),
      headerH:   h.offsetHeight,
      colW:      ((h.scrollWidth || s.scrollWidth || s.offsetWidth) - TIME_COLUMN_WIDTH) / 7,
      scrollTop: s.scrollTop,
      scrollLeft: s.scrollLeft,
    }
  }, [])

  // ─── DRAG: mover ────────────────────────────────────────────────────────────
  const handleMoveDown = useCallback((e: React.PointerEvent, event: AgendaEvent, color: string) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const eventEl = eventRefs.current.get(event.id) as HTMLDivElement
    if (!eventEl) return

    const rect = eventEl.getBoundingClientRect()
    const clickOffsetY = e.clientY - rect.top
    const durationMin  = (new Date(event.endsAt).getTime() - new Date(event.startsAt).getTime()) / 60000
    const startClientX = e.clientX
    const startClientY = e.clientY

    // Ghost segue o mouse; original fica opaco
    const ghost = spawnGhost(rect, color, event.title,
      `${fmt(new Date(event.startsAt))} - ${fmt(new Date(event.endsAt))}`)
    eventEl.style.opacity    = '0.2'
    eventEl.style.transition = 'none'

    let lastDayIdx  = -1
    let lastStartMin = -1

    function onMove(ev: PointerEvent) {
      const m = getMetrics()
      if (!m) return

      // Mover ghost via transform — GPU, zero React
      ghost.style.transform = `translate(${ev.clientX - startClientX}px,${ev.clientY - startClientY}px)`

      // Calcular snap: Y → minutos, X → coluna do dia
      const gridY  = ev.clientY - m.rect.top - m.headerH + m.scrollTop - clickOffsetY
      const rawMin = (gridY / HOUR_HEIGHT) * 60 + GRID_START_HOUR * 60
      const startMin = clamp(snapTo(rawMin), GRID_OFFSET_MIN, 23 * 60 - durationMin)
      const endMin   = startMin + durationMin

      const rawX   = ev.clientX - m.rect.left + m.scrollLeft - TIME_COLUMN_WIDTH
      const dayIdx = clamp(Math.floor(rawX / m.colW), 0, 6)

      // Atualizar label de horário no ghost diretamente no DOM
      const targetDay = addDays(weekStart, dayIdx)
      const ns = new Date(targetDay)
      ns.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0)
      const ne = new Date(ns.getTime() + durationMin * 60000);
      (ghost.querySelector('[data-ghost-time]') as HTMLElement).textContent = `${fmt(ns)} - ${fmt(ne)}`

      // State React só muda ao cruzar boundary de snap (não por pixel)
      if (dayIdx !== lastDayIdx || startMin !== lastStartMin) {
        lastDayIdx   = dayIdx
        lastStartMin = startMin
        setMoveSnap({ dayIdx, startMin, endMin })
      }
    }

    function onUp(ev: PointerEvent) {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)

      ghost.remove()
      eventEl.style.transition = ''
      setMoveSnap(null)

      const moved = Math.abs(ev.clientX - startClientX) > MIN_DRAG_PX
                 || Math.abs(ev.clientY - startClientY) > MIN_DRAG_PX

      if (!moved) {
        eventEl.style.opacity = ''
        onEditEvent(event)
        return
      }

      if (lastDayIdx >= 0 && lastStartMin >= 0) {
        eventEl.style.opacity = '0'
        const targetDay = addDays(weekStart, lastDayIdx)
        const ns = new Date(targetDay)
        ns.setHours(Math.floor(lastStartMin / 60), lastStartMin % 60, 0, 0)
        const ne = new Date(ns.getTime() + durationMin * 60000)
        onUpdateEvent(event.id, ns.toISOString(), ne.toISOString())
        // Para movimentos no mesmo dia, React compara vdom opacity:1→1 e não atualiza
        // o DOM — o elemento fica preso em opacity:0. O rAF garante a limpeza.
        requestAnimationFrame(() => { eventEl.style.opacity = '' })
      } else {
        eventEl.style.opacity = ''
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
  }, [getMetrics, onEditEvent, onUpdateEvent, weekStart])

  // ─── DRAG: redimensionar ────────────────────────────────────────────────────
  const handleResizeDown = useCallback((e: React.PointerEvent, event: AgendaEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    const eventEl = eventRefs.current.get(event.id) as HTMLDivElement
    if (!eventEl) return

    const start    = new Date(event.startsAt)
    const startMin = mfm(start)
    let lastEndMin = mfm(new Date(event.endsAt))

    // Capturar métricas uma vez no início — evita getBoundingClientRect a cada frame
    const m0 = getMetrics()
    if (!m0) return
    const cachedRect      = m0.rect
    const cachedHeaderH   = m0.headerH
    let cachedScrollTop = m0.scrollTop

    const timeEl = eventEl.querySelector('[data-event-time]') as HTMLElement | null

    function onMove(ev: PointerEvent) {
      // Atualiza scrollTop se o usuário rolou; rect e headerH não mudam durante drag
      cachedScrollTop = scrollRef.current?.scrollTop ?? cachedScrollTop

      const gridY  = ev.clientY - cachedRect.top - cachedHeaderH + cachedScrollTop
      const endMin = Math.max(startMin + SNAP_MIN, snapTo((gridY / HOUR_HEIGHT) * 60 + GRID_START_HOUR * 60))
      if (endMin === lastEndMin) return
      lastEndMin = endMin

      const newH = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT) - 4
      eventEl.style.height = `${newH}px`
      if (timeEl) {
        const ne = new Date(start)
        ne.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0)
        timeEl.textContent = `${fmt(start)} - ${fmt(ne)}`
      }
    }

    function onUp() {
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerup',   onUp)

      if (lastEndMin !== mfm(new Date(event.endsAt))) {
        const ne = new Date(start)
        ne.setHours(Math.floor(lastEndMin / 60), lastEndMin % 60, 0, 0)
        onUpdateEvent(event.id, start.toISOString(), ne.toISOString())
        // Limpa o style inline após React re-renderizar com a nova altura (via onMutate).
        // Não limpar antes — causaria snap-back visual por 1 frame.
        requestAnimationFrame(() => { eventEl.style.height = '' })
      } else {
        eventEl.style.height = ''
      }
    }

    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup',   onUp)
  }, [getMetrics, onUpdateEvent])

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div ref={scrollRef} className="mf-workspace mf-agenda-week-scroll flex-1 min-w-0 overflow-auto select-none bg-[#07080c]">

      {/* Cabeçalho sticky */}
      <div
        ref={headerRef}
        className="mf-agenda-week-grid mf-agenda-week-header grid grid-cols-[65px_repeat(7,1fr)] sticky top-0 bg-[#07080c]/90 backdrop-blur-md z-10 border-b border-white/[0.06] shadow-[0_4px_20px_rgba(0,0,0,0.15)]"
      >
        <div className="border-r border-white/[0.04]" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, today)
          return (
            <div key={i} className="text-center py-3 border-r border-white/[0.03] last:border-r-0 flex flex-col justify-between min-h-[76px]">
              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                {WEEKDAY_LABELS[day.getDay()]}
              </div>
              <div className="flex-1 flex flex-col items-center justify-center mt-1">
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl text-xs font-bold transition-all duration-200 ${
                  isToday
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.4)] border border-blue-400/20'
                    : 'text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent'
                }`}>
                  {day.getDate()}
                </div>
                {isToday && (
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1 shadow-[0_0_8px_rgba(59,130,246,1)] animate-pulse" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Grade */}
      <div className="mf-agenda-week-grid grid grid-cols-[65px_repeat(7,1fr)]">

        {/* Coluna de horários */}
        <div className="border-r border-white/[0.04] bg-[#07080c]/30">
          {HOURS.map((hour) => (
            <div key={hour} style={{ height: HOUR_HEIGHT }} className="relative pr-3">
              <span className="absolute top-0 right-3 -translate-y-1/2 text-[10px] font-bold text-slate-500/80 tracking-wider">
                {formatHourLabel(hour)}
              </span>
            </div>
          ))}
        </div>

        {/* Colunas dos dias */}
        {days.map((day, dayIndex) => {
          const dayEvents = events.filter(e => isSameDay(new Date(e.startsAt), day))
          const positioned = layoutDayEvents(dayEvents)
          const isToday = isSameDay(day, today)

          // Snap indicator para este dia durante move drag
          const snap = moveSnap?.dayIdx === dayIndex ? moveSnap : null

          return (
            <div
              key={dayIndex}
              className={`relative border-r border-white/[0.03] last:border-r-0 ${isToday ? 'bg-gradient-to-b from-blue-500/[0.015] to-transparent' : ''}`}
            >
              {/* Células clicáveis (criar evento) */}
              {HOURS.map(hour => (
                <div
                  key={hour}
                  style={{ height: HOUR_HEIGHT }}
                  className="border-b border-white/[0.04] cursor-pointer hover:bg-white/[0.015] transition-colors duration-150"
                  onClick={() => onCreateAt(day, hour)}
                />
              ))}

              {/* Indicador de destino do drag (slot alvo) */}
              {snap && (
                <div
                  style={{
                    position:  'absolute',
                    top:       ((snap.startMin - GRID_OFFSET_MIN) / 60) * HOUR_HEIGHT + 2,
                    height:    Math.max(((snap.endMin - snap.startMin) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT) - 4,
                    left:      2,
                    right:     4,
                    borderRadius: 8,
                    border:    '2px dashed rgba(255,255,255,0.28)',
                    background: 'rgba(255,255,255,0.04)',
                    pointerEvents: 'none',
                  }}
                />
              )}

              {isToday && showNowIndicator && (
                <div
                  className="mf-agenda-now-line"
                  style={{ top: nowIndicatorTop }}
                  aria-hidden="true"
                >
                  <span />
                </div>
              )}

              {/* Eventos */}
              {positioned.map(({ event, column, columnCount }) => {
                const start    = new Date(event.startsAt)
                const end      = new Date(event.endsAt)
                const startMin = mfm(start)
                const endMin   = mfm(end)
                const top    = ((startMin - GRID_OFFSET_MIN) / 60) * HOUR_HEIGHT
                const height = Math.max(((endMin - startMin) / 60) * HOUR_HEIGHT, MIN_EVENT_HEIGHT)
                const widthPct = 100 / columnCount
                const leftPct  = column * widthPct
                const color    = event.category?.color ?? '#64748b'
                const isRealizada    = event.status === 'REALIZADA'
                const isFalta        = event.status === 'FALTA'
                const isNaoRealizada = event.status === 'NAO_REALIZADA'
                const eventColor = isRealizada ? '#ca8a04' : isFalta ? '#ef4444' : isNaoRealizada ? '#6b7280' : color

                return (
                  <div
                    key={event.id}
                    ref={el => {
                      if (el) eventRefs.current.set(event.id, el)
                      else eventRefs.current.delete(event.id)
                    }}
                    style={{
                      position:        'absolute',
                      top:             top + 2,
                      height:          height - 4,
                      width:           `calc(${widthPct}% - 4px)`,
                      left:            `calc(${leftPct}% + 2px)`,
                      backgroundColor: eventColor,
                      cursor:          'grab',
                    }}
                    className="mf-agenda-event-card rounded-lg overflow-hidden group/event shadow-md flex flex-col"
                    onPointerDown={ev => {
                      if (ev.pointerType === 'touch') return
                      handleMoveDown(ev, event, eventColor)
                    }}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      onEditEvent(event)
                    }}
                  >
                    {/* Badge de status */}
                    {(isRealizada || isFalta || isNaoRealizada) && (
                      <div className={`absolute top-0.5 right-0.5 w-4 h-4 rounded-full flex items-center justify-center pointer-events-none z-10 ${isRealizada ? 'bg-yellow-600/90' : isFalta ? 'bg-red-700/90' : 'bg-slate-500/90'}`}>
                        {isRealizada
                          ? <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                          : <X className="w-2.5 h-2.5 text-white" strokeWidth={3} />
                        }
                      </div>
                    )}

                    {/* Conteúdo */}
                    <div className="px-2.5 py-1.5 flex-1 select-none pointer-events-none overflow-hidden flex flex-col relative z-[1]">
                      <span className="flex items-center gap-1 min-w-0">
                        {event.lead?.temperature && (
                          <span className="text-[11px] shrink-0">{event.lead.temperature}</span>
                        )}
                        <span className={`text-[11px] font-bold text-white truncate leading-tight tracking-tight ${isRealizada ? 'line-through opacity-70' : ''}`}>
                          {event.title}
                        </span>
                      </span>
                      {height >= 38 && (
                        <span
                          data-event-time
                          className="text-[9px] text-white/75 font-semibold truncate block mt-0.5 leading-none"
                        >
                          {fmt(start)} - {fmt(end)}
                        </span>
                      )}
                    </div>

                    {/* Handle de resize (borda inferior) */}
                    <div
                      className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize opacity-0 group-hover/event:opacity-100 transition-opacity duration-150 flex items-end justify-center pb-0.5"
                      onPointerDown={ev => handleResizeDown(ev, event)}
                    >
                      <div className="w-8 h-[3px] rounded-full bg-white/55" />
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
