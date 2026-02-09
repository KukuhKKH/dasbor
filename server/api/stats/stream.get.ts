import { statsCache } from '../../utils/stats-cache'

export default defineEventHandler(async (event) => {
    // Set headers for SSE
    setHeader(event, 'Content-Type', 'text/event-stream')
    setHeader(event, 'Cache-Control', 'no-cache')
    setHeader(event, 'Connection', 'keep-alive')
    setResponseStatus(event, 200)

    const send = (data: any) => {
        event.node.res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    if (statsCache.data) {
        send(statsCache.data)
    }

    const onUpdate = (data: any) => {
        send(data)
    }

    statsCache.on('update', onUpdate)

    event.node.req.on('close', () => {
        statsCache.off('update', onUpdate)
        event.node.res.end()
    })

    await new Promise(() => { })
})
