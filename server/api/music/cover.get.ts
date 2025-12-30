import path from 'node:path';
import { parseFile } from 'music-metadata';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const filename = query.file as string;
  const filePath = path.join('/music', filename);

  try {
    const metadata = await parseFile(filePath);
    const picture = metadata.common.picture?.[0];

    if (picture) {
      setResponseHeader(event, 'Content-Type', picture.format);
      setResponseHeader(event, 'Cache-Control', 'public, max-age=86400');
      return picture.data;
    }
  } catch (e) {}
  
  // Return redirect ke placeholder jika gagal
  return sendRedirect(event, 'https://placehold.co/400?text=No+Cover&bg=1e293b&fg=ffffff');
});