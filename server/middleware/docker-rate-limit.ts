// Middleware: Rate limit semua request ke /api/docker/**
// 60 req/menit per IP — mencegah scraping/abuse tanpa mengganggu penggunaan normal

// Nitro auto-imports dari server/utils/
const dockerLimiter = createRateLimiter(60, 60_000)

export default defineEventHandler((event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/docker')) return

  const ip = getClientIp(event)

  if (!dockerLimiter.check(ip)) {
    const retryMs = dockerLimiter.retryAfterMs(ip)
    const retrySeconds = Math.ceil(retryMs / 1000)

    setResponseHeader(event, 'Retry-After', String(retrySeconds))
    setResponseHeader(event, 'X-RateLimit-Limit', '60')
    setResponseHeader(event, 'X-RateLimit-Reset', String(Math.ceil((Date.now() + retryMs) / 1000)))

    throw createError({
      statusCode: 429,
      statusMessage: `Rate limit exceeded. Retry after ${retrySeconds}s`,
    })
  }
})
