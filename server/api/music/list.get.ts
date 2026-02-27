import { buildMusicApiUrl, buildMusicApiHeaders } from '../../utils/music'

export default defineEventHandler(async (event) => {
  try {
    const response = await fetch(buildMusicApiUrl(event, '/api/music/list'), {
      headers: buildMusicApiHeaders(),
      signal: AbortSignal.timeout(5000)
    })
    
    if (!response.ok) {
      console.warn(`Music API returned ${response.status}: ${response.statusText}`)
      return []
    }

    const { data } = await response.json()
    return Array.isArray(data) ? data : []
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      console.error('Music API request timed out after 5s')
    } else {
      console.error('Failed to fetch music list:', error.message)
    }

    return []
  }
})