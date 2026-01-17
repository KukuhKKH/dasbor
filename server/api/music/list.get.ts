import { buildMusicApiUrl, buildMusicApiHeaders } from '../../utils/music'

export default defineEventHandler(async (event) => {
  try {
    const response = await fetch(buildMusicApiUrl(event, '/api/music/list'), {
      headers: buildMusicApiHeaders(),
    })
    if (!response.ok)
      return []

    const { data } = await response.json().catch(() => [])
    return Array.isArray(data) ? data : []
  } catch (error) {
    console.error('Failed to fetch music list', error)
    return []
  }
})