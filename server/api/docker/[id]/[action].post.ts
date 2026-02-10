import Docker from 'dockerode'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })

export default defineEventHandler(async (event) => {
    const id = getRouterParam(event, 'id')
    const action = getRouterParam(event, 'action')

    const authToken = getCookie(event, 'docker_auth_token')
    if (authToken !== 'valid') {
        throw createError({
            statusCode: 401,
            statusMessage: 'Unauthorized'
        })
    }

    if (!id || !action) {
        throw createError({ statusCode: 400, statusMessage: 'Missing ID or action' })
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
        } else {
            throw createError({ statusCode: 400, statusMessage: 'Invalid action' })
        }

        return { success: true, action, id }
    } catch (error: any) {
        throw createError({
            statusCode: 500,
            statusMessage: error.message || 'Docker operation failed'
        })
    }
})
