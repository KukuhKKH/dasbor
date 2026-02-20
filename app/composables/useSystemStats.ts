import { ref, onMounted, onUnmounted } from 'vue'

export interface SystemStats {
    os: {
        distro: string
        release: string
        arch: string
        hostname: string
    }
    cpu: {
        load: number
        cores: number
    }
    memory: {
        total: number
        used: number
        percent: number
    }
    storage: {
        total: number
        used: number
        percent: number
    }
    network: {
        rx_sec: number
        tx_sec: number
    }
}

export interface StatsHistory {
    network: { rx: number, tx: number }
    timestamp: number
}

export function useSystemStats() {
    const data = ref<SystemStats | null>(null)
    const history = ref<StatsHistory[]>([])
    const error = ref<Error | null>(null)
    const status = ref<'connecting' | 'connected' | 'error' | 'offline'>('connecting')
    let eventSource: EventSource | null = null
    let pollInterval: ReturnType<typeof setInterval> | null = null

    // ----- FIX: Exponential backoff dengan batas retry maksimum -----
    let retryCount = 0
    const MAX_RETRIES = 10
    let retryTimeout: ReturnType<typeof setTimeout> | null = null

    const fetchStats = async () => {
        try {
            const res = await $fetch<{ stats: SystemStats, history: any[] }>('/api/stats')
            data.value = res.stats
            history.value = res.history.map((h: any) => ({
                network: h.network,
                timestamp: h.timestamp
            }))
            status.value = 'connected'
            error.value = null
        } catch (e: any) {
            console.error('Fetch stats error:', e)
            error.value = e
            status.value = 'error'
        }
    }

    const startPolling = () => {
        fetchStats()
        pollInterval = setInterval(fetchStats, 2000)
    }

    const connectSSE = () => {
        if (typeof EventSource === 'undefined') {
            startPolling()
            return
        }

        // Fetch initial state first to populate history
        fetchStats().then(() => {
            eventSource = new EventSource('/api/stats/stream')

            eventSource.onopen = () => {
                status.value = 'connected'
                error.value = null
                // ----- FIX: Reset retry counter saat berhasil konek -----
                retryCount = 0
            }

            eventSource.onmessage = (event) => {
                try {
                    const newData = JSON.parse(event.data)
                    data.value = newData

                    // Push to history
                    const newPoint: StatsHistory = {
                        network: { rx: newData.network.rx_sec, tx: newData.network.tx_sec },
                        timestamp: Date.now()
                    }
                    history.value.push(newPoint)

                    // Limit frontend history to keep it snappy (e.g. 50 points)
                    if (history.value.length > 50) {
                        history.value.shift()
                    }
                } catch (e) {
                    console.error('Failed to parse stats:', e)
                }
            }

            eventSource.onerror = (e) => {
                console.error('SSE Error:', e)
                eventSource?.close()
                eventSource = null

                // ----- FIX: Henti retry jika sudah melewati batas maksimum -----
                if (retryCount >= MAX_RETRIES) {
                    console.warn(`SSE: Reached max retries (${MAX_RETRIES}). Giving up.`)
                    status.value = 'offline'
                    return
                }

                status.value = 'error'

                // ----- FIX: Exponential backoff — delay 1s, 2s, 4s, 8s, ..., maks 30s -----
                const delay = Math.min(1000 * 2 ** retryCount, 30_000)
                console.warn(`SSE: Reconnecting in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`)
                retryCount++

                retryTimeout = setTimeout(connectSSE, delay)
            }
        })
    }

    onMounted(() => {
        connectSSE()
    })

    onUnmounted(() => {
        if (eventSource) {
            eventSource.close()
            eventSource = null
        }
        if (pollInterval) {
            clearInterval(pollInterval)
            pollInterval = null
        }
        // ----- FIX: Bersihkan retry timeout agar tidak reconnect setelah unmount -----
        if (retryTimeout) {
            clearTimeout(retryTimeout)
            retryTimeout = null
        }
    })

    return {
        data,
        history,
        error,
        status,
    }
}
