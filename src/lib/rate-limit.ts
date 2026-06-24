const RATE_LIMIT_PER_MINUTE = 30
const sentTimestamps: number[] = []

export function checkRateLimit(): boolean {
  const now = Date.now()
  while (sentTimestamps.length && now - sentTimestamps[0] > 60_000) sentTimestamps.shift()
  if (sentTimestamps.length >= RATE_LIMIT_PER_MINUTE) return false
  sentTimestamps.push(now)
  return true
}
