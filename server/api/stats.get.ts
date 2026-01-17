import si from 'systeminformation'
import fs from 'fs/promises'

export default defineEventHandler(async () => {

   try {
      const [os, cpu, mem, fsSize, net] = await Promise.all([
         si.osInfo(),
         si.currentLoad(),
         si.mem(),
         si.fsSize(),
         si.networkStats(),
      ])

      let hostHostname = os.hostname
      try {
         hostHostname = (await fs.readFile('/host/etc/hostname', 'utf8')).trim()
      } catch {}

      const rootFs = fsSize.find(d => d.mount === '/') || fsSize[0]
      const defaultNet = net.find(i => i.iface !== 'lo') || net[0]

      return {
         os: {
            distro: os.distro,
            release: os.release,
            arch: os.arch,
            hostname: hostHostname,
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