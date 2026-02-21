interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Bersihkan entry lama setiap 5 menit agar tidak memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

/**
 * In-memory rate limiter per key (biasanya IP address).
 * @param key     Identifier unik (IP)
 * @param limit   Max requests dalam window
 * @param windowMs Durasi window dalam milidetik
 * @returns true jika masih dalam batas, false jika sudah melebihi
 */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) {
    return false
  }

  entry.count++
  return true
}

/**
 * Ambil IP address dari H3 event (mendukung proxy headers).
 */
export function getClientIp(event: import('h3').H3Event): string {
  const headers = event.node.req.headers
  const forwarded = headers['x-forwarded-for']

  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0]!.trim()
  }

  return event.node.req.socket?.remoteAddress ?? 'unknown'
}
