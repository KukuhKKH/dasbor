import Docker from 'dockerode'
const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/i

const ALLOWED_ACTIONS = new Set(['start', 'stop', 'restart'])

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

  try {
    const container = docker.getContainer(id)
    await container.inspect()

    if (action === 'start') {
      await container.start()
    } else if (action === 'stop') {
      await container.stop()
    } else if (action === 'restart') {
      await container.restart()
    }

    return { success: true, action, id }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Docker operation failed',
    })
  }
})
