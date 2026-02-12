import si from 'systeminformation'
import fs from 'fs/promises'
import { statsCache, type SystemStats } from '../utils/stats-cache'

export default defineNitroPlugin((nitroApp) => {
    let cachedOsInfo: any = null
    let cachedFsSize: any = null
    let cachedHostname: string | null = null

    // Helper to get hostname (Docker friendly)
    const getHostname = async () => {
        if (cachedHostname) return cachedHostname
        try {
            const os = await si.osInfo()
            let hostHostname = os.hostname

            try {
                hostHostname = (await fs.readFile('/host/etc/hostname', 'utf8')).trim()
            } catch {
            }

            cachedHostname = hostHostname
            return hostHostname
        } catch {
            return 'Unknown'
        }
    }

    // Slow loop: OS Info & Storage (every 60s)
    const updateSlowStats = async () => {
        try {
            const [os, fsSize] = await Promise.all([
                si.osInfo(),
                si.fsSize(),
            ])

            cachedOsInfo = os
            cachedFsSize = fsSize
        } catch (e) {
            console.error('[StatsPoller] Failed to update slow stats:', e)
        }
    }

    const updateFastStats = async () => {
        try {
            if (!cachedOsInfo || !cachedFsSize) {
                await updateSlowStats()
            }

            const [cpu, mem, net] = await Promise.all([
                si.currentLoad(),
                si.mem(),
                si.networkStats(),
            ])

            const hostname = await getHostname()
            const rootFs = cachedFsSize.find((d: any) => d.mount === '/') || cachedFsSize[0]
            const defaultNet = net.find(i => i.iface !== 'lo') || net[0]

            const stats: SystemStats = {
                os: {
                    distro: cachedOsInfo.distro,
                    release: cachedOsInfo.release,
                    arch: cachedOsInfo.arch,
                    hostname: hostname,
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
                timestamp: Date.now(),
            }

            statsCache.data = stats
        } catch (e) {
            console.error('[StatsPoller] Failed to update fast stats:', e)
        }
    }

    // Initial update
    updateSlowStats().then(updateFastStats)

    let fastActionInterval: NodeJS.Timeout | null = null

    setInterval(updateSlowStats, 60000)

    setInterval(() => {
        if (statsCache.activeListeners > 0) {
            if (!fastActionInterval) {
                console.log('[StatsPoller] Client connected, starting fast polling')
                updateFastStats()
                fastActionInterval = setInterval(updateFastStats, 2000)
            }
        } else {
            if (fastActionInterval) {
                console.log('[StatsPoller] No clients, stopping fast polling')
                clearInterval(fastActionInterval)
                fastActionInterval = null
            }
        }
    }, 1000)
})
