import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'

const DEFAULT_MUSIC_API_BASE = 'http://localhost:3000'
const DEFAULT_PLACEHOLDER_URL = 'https://placehold.co/400?text=No+Cover&bg=1e293b&fg=ffffff'
const MUSIC_API_KEY_PREFIX = 'app-music-'
const MUSIC_API_HEADER = 'X-API-Key'

export const buildMusicApiUrl = (event: H3Event, pathname: string) => {
  const baseUrl = getMusicApiBaseUrl(event)
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return new URL(normalizedPath, baseUrl).toString()
}

export const buildMusicApiHeaders = (): Record<string, string> => ({
  [MUSIC_API_HEADER]: getMusicApiKey(),
})

export const getMusicApiKey = (date = new Date()) => {
  const todayUTC = date.toISOString().slice(0, 10)
  const raw = `${MUSIC_API_KEY_PREFIX}${todayUTC}`
  return createHash('sha256').update(raw).digest('hex')
}

export const getMusicApiBaseUrl = (event: H3Event) => {
  const config = useRuntimeConfig(event)
  return config.musicApi?.baseUrl || DEFAULT_MUSIC_API_BASE
}

export const getMusicPlaceholderUrl = (event: H3Event) => {
  const config = useRuntimeConfig(event)
  return config.musicApi?.placeholderUrl || DEFAULT_PLACEHOLDER_URL
}
