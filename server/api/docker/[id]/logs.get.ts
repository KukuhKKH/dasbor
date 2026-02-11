import Docker from 'dockerode'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const query = getQuery(event)

    // Auth Check
    const authToken = getCookie(event, 'docker_auth_token')
    if (authToken !== 'valid') {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized'
        })
    }

    if (!id) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID' })
    }

    try {
        const container = docker.getContainer(id)

        const opts: any = {
            stdout: true,
            stderr: true,
            tail: query.tail ? Number(query.tail) : 500,
            timestamps: query.timestamps === 'true',
            follow: false // Fetch once, not stream for now to keep it simple
        }

        const logsBuffer = await container.logs(opts)

        let logs = logsBuffer.toString('utf-8')

        return {
            id,
            logs,
            timestamp: Date.now()
        }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Failed to fetch logs'
        })
    }
})
