import path from 'node:path'
import { Readable } from 'stream'
import { sendStream } from 'h3'
import { buildMusicApiUrl, buildMusicApiHeaders, getMusicPlaceholderUrl } from '../../utils/music'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const rawFilename = query.file as string
  const filename = rawFilename ? path.basename(rawFilename) : ''

  if (!filename || filename !== rawFilename) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const remoteUrl = `${buildMusicApiUrl(event, '/api/music/cover')}?file=${encodeURIComponent(filename)}`

  try {
    const response = await fetch(remoteUrl, {
      headers: buildMusicApiHeaders(),
    })

    if (response.status === 302) {
      const redirectUrl = response.headers.get('location') || getMusicPlaceholderUrl(event)
      return sendRedirect(event, redirectUrl, 302)
    }

    if (!response.ok) {
      let statusMessage = response.statusText
      try {
        const payload = await response.clone().json()
        statusMessage = payload?.statusMessage || payload?.message || statusMessage
      } catch {}
      throw createError({ statusCode: response.status, statusMessage })
    }

    const body = response.body
    if (!body)
      throw createError({ statusCode: 502, statusMessage: 'Upstream cover unavailable' })

    setResponseStatus(event, response.status)
    response.headers.forEach((value, key) => {
      if (value)
        setResponseHeader(event, key, value)
    })

  return sendStream(event, Readable.fromWeb(body as any))
  } catch (error) {
    console.error('Failed to fetch cover from upstream', error)
    return sendRedirect(event, getMusicPlaceholderUrl(event))
  }
})