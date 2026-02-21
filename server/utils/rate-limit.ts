interface RateLimitEntry {
  count: number
  resetAt: number
}

// Bersihkan entry lama setiap 5 menit agar tidak memory leak
function createStore() {
  const store = new Map<string, RateLimitEntry>()
  setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key)
    }
  }, 5 * 60 * 1000)
  return store
}

// Global store untuk checkRateLimit (dipakai auth.post.ts)
const globalStore = createStore()

/**
 * In-memory rate limiter per key (biasanya IP address).
 * @returns true jika masih dalam batas, false jika sudah melebihi
 */
export function checkRateLimit(
  key: string,
  limit = 10,
  windowMs = 60_000,
): boolean {
  return checkInStore(globalStore, key, limit, windowMs)
}

/**
 * Factory: buat rate limiter dengan store-nya sendiri.
 * Berguna untuk middleware yang butuh limit berbeda.
 */
export function createRateLimiter(limit: number, windowMs: number) {
  const store = createStore()
  return {
    check(key: string): boolean {
      return checkInStore(store, key, limit, windowMs)
    },
    /**
     * Sisa waktu (ms) sampai window reset untuk key tertentu.
     * Returns 0 jika tidak ada entry atau sudah expired.
     */
    retryAfterMs(key: string): number {
      const entry = store.get(key)
      if (!entry || entry.resetAt < Date.now()) return 0
      return Math.max(0, entry.resetAt - Date.now())
    },
  }
}

function checkInStore(
  store: Map<string, RateLimitEntry>,
  key: string,
  limit: number,
  windowMs: number,
): boolean {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false
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
