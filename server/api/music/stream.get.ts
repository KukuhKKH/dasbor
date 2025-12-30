import fs from 'node:fs';
import path from 'node:path';
import { sendStream } from 'h3';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const filename = query.file as string;
  
  if (!filename || filename.includes('..')) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  const filePath = path.join('/music', filename);
  if (!fs.existsSync(filePath)) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = event.node.req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(filePath, { start, end });
    
    setResponseHeader(event, 'Content-Range', `bytes ${start}-${end}/${fileSize}`);
    setResponseHeader(event, 'Accept-Ranges', 'bytes');
    setResponseHeader(event, 'Content-Length', chunksize);
    setResponseHeader(event, 'Content-Type', 'audio/mpeg');
    setResponseStatus(event, 206);
    return sendStream(event, file);
  } else {
    const file = fs.createReadStream(filePath);
    setResponseHeader(event, 'Content-Length', fileSize);
    setResponseHeader(event, 'Content-Type', 'audio/mpeg');
    return sendStream(event, file);
  }
});