import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

export default defineEventHandler(async (event) => {
   try {
      const containers = await docker.listContainers({ all: true });

      const formattedContainers = containers.map((c) => {

         const rawImage = c.Image || 'unknown';
         const cleanImage = rawImage.replace('sha256:', '');

         let cleanName = 'System/Unknown';
         if (c.Names && c.Names.length > 0) {
            cleanName = c.Names[0].replace(/^\//, '');
         }


         return {
            id: c.Id.substring(0, 12),
            name: cleanName,
            image: cleanImage,
            state: c.State,
            status: c.Status,
            created: c.Created,
            ports: c.Ports || [],
            labels: c.Labels || {},

         };
      });

      return formattedContainers;

   } catch (error: any) {
      console.error('Docker API Error:', error);

      if (error.code === 'EACCES' || error.syscall === 'connect') {
         throw createError({
            statusCode: 500,
            statusMessage: 'Permission Denied: Cannot access /var/run/docker.sock. Check user permissions.',
         });
      }

      throw createError({
         statusCode: 500,
         statusMessage: error.message || 'Failed to fetch containers',
      });
   }
});