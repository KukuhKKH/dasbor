import Docker from 'dockerode'

const docker = new Docker({ socketPath: '/var/run/docker.sock' })
const CONTAINER_ID_RE = /^[a-f0-9]{12,64}$/i

/**
 * Tarik image terbaru dari registry menggunakan modem Dockerode.
 * Mengembalikan Promise yang resolve saat pull selesai.
 */
function pullImage(image: string): Promise<void> {
  return new Promise((resolve, reject) => {
    docker.pull(image, (err: Error | null, stream: any) => {
      if (err) return reject(err)
      docker.modem.followProgress(stream, (err: Error | null) => {
        if (err) return reject(err)
        resolve()
      })
    })
  })
}

export default defineEventHandler(async (event) => {
  requireDockerAuth(event)

  const id = getRouterParam(event, 'id')
  if (!id || !CONTAINER_ID_RE.test(id)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid container ID' })
  }

  const container = docker.getContainer(id)

  let info: Awaited<ReturnType<typeof container.inspect>>
  try {
    info = await container.inspect()
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Container not found' })
  }

  const image = info.Config.Image
  const swarmServiceId: string | undefined = info.Config.Labels?.['com.docker.swarm.service.id']

  // 1. Pull image terbaru
  try {
    await pullImage(image)
  } catch (e: any) {
    throw createError({
      statusCode: 502,
      statusMessage: `Failed to pull image "${image}": ${e.message}`,
    })
  }

  // 2a. Swarm: force update service (rolling update, zero downtime)
  if (swarmServiceId) {
    try {
      const service = docker.getService(swarmServiceId)
      const serviceInfo = await service.inspect()

      const version = serviceInfo.Version.Index
      const spec = serviceInfo.Spec

      // Increment ForceUpdate counter untuk trigger rolling update
      spec.TaskTemplate = spec.TaskTemplate || {}
      spec.TaskTemplate.ForceUpdate = (spec.TaskTemplate.ForceUpdate ?? 0) + 1

      await service.update({ version, ...spec })

      return {
        success: true,
        strategy: 'swarm-service-update',
        image,
        serviceId: swarmServiceId,
      }
    } catch (e: any) {
      throw createError({
        statusCode: 500,
        statusMessage: `Image pulled but service update failed: ${e.message}`,
      })
    }
  }

  // 2b. Standalone: restart container
  try {
    if (info.State.Running) {
      await container.restart()
    } else {
      await container.start()
    }
    return {
      success: true,
      strategy: 'container-restart',
      image,
    }
  } catch (e: any) {
    throw createError({
      statusCode: 500,
      statusMessage: `Image pulled but container restart failed: ${e.message}`,
    })
  }
})
