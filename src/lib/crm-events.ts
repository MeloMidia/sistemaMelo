import { EventEmitter } from 'events'

export type CrmEvent =
  | { type: 'new-message'; leadId: string; message: unknown }
  | { type: 'connection-update'; status: string }

const globalForEvents = globalThis as typeof globalThis & { crmEventEmitter?: EventEmitter }

export const crmEvents = globalForEvents.crmEventEmitter ?? new EventEmitter()
crmEvents.setMaxListeners(0)

if (process.env.NODE_ENV !== 'production') globalForEvents.crmEventEmitter = crmEvents

export function emitCrmEvent(event: CrmEvent) {
  crmEvents.emit('event', event)
}

export function subscribeCrmEvents(listener: (event: CrmEvent) => void): () => void {
  crmEvents.on('event', listener)
  return () => crmEvents.off('event', listener)
}
