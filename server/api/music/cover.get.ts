import fs from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const filename = query.file as string

  if (!filename || filename.includes('..')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
  }

  let baseDir = process.env.NUXT_PUBLIC_MUSIC_DIR

  if (!baseDir) {
    baseDir = process.env.NODE_ENV === 'production' 
      ? './.output/public/music' 
      : './public/music'
  }

  const musicDir = path.resolve(process.cwd(), baseDir)
  const filePath = path.join(musicDir, filename)

  if (!fs.existsSync(filePath)) {
    return sendRedirect(event, 'https://placehold.co/400?text=No+Cover&bg=1e293b&fg=ffffff')
  }

  try {
    const metadata = await parseFile(filePath)
    const picture = metadata.common.picture?.[0]

    if (picture) {
      setResponseHeader(event, 'Content-Type', picture.format)
      setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
      return picture.data
    }
  } catch (e) {}
  
  // Return redirect ke placeholder jika gagal
  return sendRedirect(event, 'https://placehold.co/400?text=No+Cover&bg=1e293b&fg=ffffff')
})