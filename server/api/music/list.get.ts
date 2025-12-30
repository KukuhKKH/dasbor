import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'

export default defineEventHandler(async () => {
  let baseDir = process.env.NUXT_PUBLIC_MUSIC_DIR

  if (!baseDir) {
    baseDir = process.env.NODE_ENV === 'production' 
      ? './.output/public/music' 
      : './public/music'
  }

  const musicDir = path.resolve(process.cwd(), baseDir)

  try {
    if (!fs.existsSync(musicDir))
      return []

    const files = fs.readdirSync(musicDir)
      .filter(file => file.endsWith('.mp3'))
      .sort(() => 0.5 - Math.random())
      .slice(0, 20)

    const playlist = await Promise.all(files.map(async (file) => {
      const filePath = path.join(musicDir, file)
      try {
        const metadata = await parseFile(filePath, { skipCovers: true })
        return {
          filename: file,
          title: metadata.common.title || file,
          artist: metadata.common.artist || 'Unknown',
          streamUrl: `/api/music/stream?file=${encodeURIComponent(file)}`,
          coverUrl: `/api/music/cover?file=${encodeURIComponent(file)}`
        }
      } catch (e) { return null }
    }))

    return playlist.filter(Boolean)
  } catch (error) {
    return []
  }
})