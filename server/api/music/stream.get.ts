import { Readable } from 'stream'
import { sendStream } from 'h3'
import { buildMusicApiUrl, buildMusicApiHeaders } from '../../utils/music'

const SUCCESS_STATUSES = new Set([200, 206])

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const filename = query.file as string

  if (!filename || filename.includes('..')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  const rangeHeader = event.node.req.headers.range
  const remoteUrl = `${buildMusicApiUrl(event, '/api/music/stream')}?file=${encodeURIComponent(filename)}`

  const headers = buildMusicApiHeaders()
  if (rangeHeader)
    headers.Range = rangeHeader

  const response = await fetch(remoteUrl, { headers })

  if (!SUCCESS_STATUSES.has(response.status)) {
    let statusMessage = response.statusText
    try {
      const payload = await response.clone().json()
      statusMessage = payload?.statusMessage || payload?.message || statusMessage
    } catch {}

    throw createError({ statusCode: response.status, statusMessage })
  }

  const body = response.body
  if (!body) {
    throw createError({ statusCode: 502, statusMessage: 'Upstream music stream unavailable' })
  }

  setResponseStatus(event, response.status)
  response.headers.forEach((value, key) => {
    if (value)
      setResponseHeader(event, key, value)
  })

  return sendStream(event, Readable.fromWeb(body as any))
})