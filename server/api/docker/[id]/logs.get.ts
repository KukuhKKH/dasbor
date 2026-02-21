import Docker from 'dockerode'
const docker = new Docker({ socketPath: '/var/run/docker.sock' })

const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/i
const MIN_TAIL = 1
const MAX_TAIL = 5000
const DEFAULT_TAIL = 500

export default defineEventHandler(async (event) => {
  requireDockerAuth(event)

  const id = getRouterParam(event, 'id')

  if (!id || !CONTAINER_ID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid container ID' })
  }

  const query = getQuery(event)
  const rawTail = Number(query.tail)
  const tail = Number.isFinite(rawTail)
    ? Math.min(Math.max(rawTail, MIN_TAIL), MAX_TAIL)
    : DEFAULT_TAIL

  try {
    const container = docker.getContainer(id)

    const opts: any = {
      stdout: true,
      stderr: true,
      tail,
      timestamps: query.timestamps === 'true',
      follow: false,
    }

    const logsRaw = await container.logs(opts) as unknown as Buffer
    const logs = logsRaw.toString('utf-8')

    return {
      id,
      logs,
      timestamp: Date.now(),
    }
  } catch (error: any) {
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'Failed to fetch logs',
    })
  }
})
