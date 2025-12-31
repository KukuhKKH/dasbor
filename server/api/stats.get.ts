import si from 'systeminformation'

export default defineEventHandler(async () => {

   try {
      const [os, cpu, mem, fs, net] = await Promise.all([
         si.osInfo(),
         si.currentLoad(),
         si.mem(),
         si.fsSize(),
         si.networkStats(),
      ])

      const rootFs = fs.find(d => d.mount === '/') || fs[0]
      const defaultNet = net.find(i => i.iface !== 'lo') || net[0]

      return {
         os: {
            distro: os.distro,
            release: os.release,
            hostname: os.hostname,
            arch: os.arch,
         },
         cpu: {
            load: Math.round(cpu.currentLoad),
            cores: cpu.cpus.length,
         },
         memory: {
            total: mem.total,
            used: mem.active,
            percent: Math.round((mem.active / mem.total) * 100),
         },
         storage: {
            total: rootFs?.size || 0,
            used: rootFs?.used || 0,
            percent: Math.round(rootFs?.use || 0),
         },
         network: {
            rx_sec: defaultNet?.rx_sec || 0,
            tx_sec: defaultNet?.tx_sec || 0,
         },
      }
   }
   catch (error) {
      return { error: 'Failed to fetch stats' }
   }
})