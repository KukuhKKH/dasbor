import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const TOKEN_VERSION = 'v1'

/**
 * Buat signed auth token dari password + timestamp.
 * Format: v1.<timestamp>.<hmac>
 */
export function createDockerAuthToken(password: string): string {
  const timestamp = Date.now().toString()
  const hmac = createHmac('sha256', password)
    .update(`${TOKEN_VERSION}:${timestamp}`)
    .digest('hex')

  return `${TOKEN_VERSION}.${timestamp}.${hmac}`
}

/**
 * Verifikasi token yang ada di cookie.
 * Returns true jika valid dan belum expired (default max 7 hari).
 */
export function verifyDockerAuthToken(
  token: string | undefined,
  password: string,
  maxAgeMs = 7 * 24 * 60 * 60 * 1000,
): boolean {
  if (!token || !password) return false

  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return false

  const [, timestamp, providedHmac] = parts
  const ts = Number(timestamp)

  if (!Number.isFinite(ts) || Date.now() - ts > maxAgeMs) return false

  const expectedHmac = createHmac('sha256', password)
    .update(`${TOKEN_VERSION}:${timestamp}`)
    .digest('hex')

  const a = Buffer.from(providedHmac!, 'hex')
  const b = Buffer.from(expectedHmac, 'hex')

  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Helper: ambil password dari runtimeConfig, throw 500 jika tidak dikonfigurasi.
 */
export function getDockerPassword(event: H3Event): string {
  const config = useRuntimeConfig(event)
  const pw = config.dockerControlPassword as string | undefined
  
  if (!pw) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Docker control password not configured on server',
    })
  }

  return pw
}

/**
 * Guard helper: lempar 401 jika token cookie tidak valid.
 */
export function requireDockerAuth(event: H3Event): void {
  const token = getCookie(event, 'docker_auth_token')
  const password = getDockerPassword(event)
  if (!verifyDockerAuthToken(token, password)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }
}
