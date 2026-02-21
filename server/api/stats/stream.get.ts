import { statsCache } from '../../utils/stats-cache'

export default defineEventHandler(async (event) => {
  setHeader(event, 'Content-Type', 'text/event-stream')
  setHeader(event, 'Cache-Control', 'no-cache')
  setHeader(event, 'Connection', 'keep-alive')
  setResponseStatus(event, 200)

  const sendEvent = (eventType: string, data: any) => {
    event.node.res.write(`event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`)
  }

  // Kirim snapshot awal
  if (statsCache.data) {
    sendEvent('stats', statsCache.data)
  }

  const onUpdate = (data: any) => sendEvent('stats', data)
  const onAlert = (alert: any) => sendEvent('alert', alert)

  statsCache.on('update', onUpdate)
  statsCache.on('alert', onAlert)

  event.node.req.on('close', () => {
    statsCache.off('update', onUpdate)
    statsCache.off('alert', onAlert)
    event.node.res.end()
  })

  await new Promise(() => { })
})
