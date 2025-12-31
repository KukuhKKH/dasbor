import Docker from 'dockerode'

export default defineEventHandler(async () => {
   const docker = new Docker({ socketPath: '/var/run/docker.sock' })

   try {
      const containers = await docker.listContainers({ all: true })

      return containers.map((c) => {
         const name = c.Names[0].replace(/^\//, '')

         return {
            id: c.Id.substring(0, 12),
            name,
            image: c.Image,
            state: c.State,
            status: c.Status,
            stack: c.Labels['com.docker.stack.namespace'] || 'Standalone',
         }
      })
   }
   catch (error: any) {
      console.error('Docker Error:', error.message)
      return []
   }
})