import Docker from 'dockerode'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/i
const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart', 'pause', 'unpause', 'remove'])

export default defineEventHandler(async (event) => {
  requireDockerAuth(event)

  const id = getRouterParam(event, 'id')
  const action = getRouterParam(event, 'action')

  if (!id || !CONTAINER_ID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid container ID' })
  }

  if (!action || !ALLOWED_ACTIONS.has(action)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid action' })
  }

  const query = getQuery(event)

  try {
    const container = docker.getContainer(id)

    // inspect dulu untuk validasi container exists + dapat state
    const info = await container.inspect()

    if (action === 'start') {
      await container.start()
    } else if (action === 'stop') {
      await container.stop()
    } else if (action === 'restart') {
      await container.restart()
    } else if (action === 'pause') {
      if (info.State.Status !== 'running') {
        throw createError({ statusCode: 409, statusMessage: 'Container is not running' })
      }
      await container.pause()
    } else if (action === 'unpause') {
      if (info.State.Status !== 'paused') {
        throw createError({ statusCode: 409, statusMessage: 'Container is not paused' })
      }
      await container.unpause()
    } else if (action === 'remove') {
      const isRunning = info.State.Status === 'running'
      const force = query.force === 'true'

      if (isRunning && !force) {
        throw createError({
          statusCode: 409,
          statusMessage: 'Container is running. Pass ?force=true to remove forcefully',
        })
      }
      await container.remove({ force })
    }

    return { success: true, action, id }
  } catch (error: any) {
    // Re-throw createError tanpa dibungkus lagi
    if (error.statusCode) throw error
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Docker operation failed',
    })
  }
})
