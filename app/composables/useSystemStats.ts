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

export function useSystemStats() {
    const data = ref<SystemStats | null>(null)
    const error = ref<Error | null>(null)
    const status = ref<'connecting' | 'connected' | 'error' | 'offline'>('connecting')
    let eventSource: EventSource | null = null
    let pollInterval: any = null

    const fetchStats = async () => {
        try {
            const res = await $fetch<SystemStats>('/api/stats')
            data.value = res
            status.value = 'connected'
            error.value = null
        } catch (e: any) {
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

        eventSource = new EventSource('/api/stats/stream')

        eventSource.onopen = () => {
            status.value = 'connected'
            error.value = null
        }

        eventSource.onmessage = (event) => {
            try {
                data.value = JSON.parse(event.data)
            } catch (e) {
                console.error('Failed to parse stats:', e)
            }
        }

        eventSource.onerror = (e) => {
            console.error('SSE Error:', e)
            status.value = 'error'
            eventSource?.close()
            setTimeout(connectSSE, 5000)
        }
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
    })

    return {
        data,
        error,
        status,
    }
}
