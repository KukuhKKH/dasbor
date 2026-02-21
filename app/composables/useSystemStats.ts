import { ref, onMounted, onUnmounted } from 'vue'
import { toast } from 'vue-sonner'

export interface NetworkInterface {
  iface: string
  rx_sec: number
  tx_sec: number
  operstate: 'up' | 'down' | 'unknown'
}

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
  interfaces: NetworkInterface[]
}

export interface StatsHistory {
  network: { rx: number; tx: number }
  timestamp: number
}

export interface AlertEvent {
  id: string
  type: 'cpu' | 'memory' | 'storage'
  level: 'warning' | 'critical'
  value: number
  threshold: number
  timestamp: number
}

const ALERT_LABELS: Record<AlertEvent['type'], string> = {
  cpu:     'CPU Usage',
  memory:  'Memory Usage',
  storage: 'Storage Usage',
}

function handleAlert(alert: AlertEvent) {
  const label = ALERT_LABELS[alert.type]
  const message = `${label} at ${alert.value}% (threshold: ${alert.threshold}%)`

  if (alert.level === 'critical') {
    toast.error(`🔴 Critical: ${message}`, { duration: 10_000 })
  } else {
    toast.warning(`⚠️ Warning: ${message}`, { duration: 7_000 })
  }
}

export function useSystemStats() {
  const data = ref<SystemStats | null>(null)
  const history = ref<StatsHistory[]>([])
  const error = ref<Error | null>(null)
  const status = ref<'connecting' | 'connected' | 'error' | 'offline'>('connecting')
  let eventSource: EventSource | null = null
  let pollInterval: ReturnType<typeof setInterval> | null = null

  let retryCount = 0
  const MAX_RETRIES = 10
  let retryTimeout: ReturnType<typeof setTimeout> | null = null

  const fetchStats = async () => {
    try {
      const res = await $fetch<{ stats: SystemStats; history: any[] }>('/api/stats')
      data.value = res.stats
      history.value = res.history.map((h: any) => ({
        network: h.network,
        timestamp: h.timestamp,
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

    fetchStats().then(() => {
      eventSource = new EventSource('/api/stats/stream')

      eventSource.onopen = () => {
        status.value = 'connected'
        error.value = null
        retryCount = 0
      }

      // Handler untuk 'stats' event (typed SSE)
      eventSource.addEventListener('stats', (event) => {
        try {
          const newData: SystemStats = JSON.parse(event.data)
          data.value = newData

          const newPoint: StatsHistory = {
            network: { rx: newData.network.rx_sec, tx: newData.network.tx_sec },
            timestamp: Date.now(),
          }
          history.value.push(newPoint)
          if (history.value.length > 50) history.value.shift()
        } catch (e) {
          console.error('Failed to parse stats:', e)
        }
      })

      // Handler untuk 'alert' event
      eventSource.addEventListener('alert', (event) => {
        try {
          const alert: AlertEvent = JSON.parse(event.data)
          handleAlert(alert)
        } catch (e) {
          console.error('Failed to parse alert:', e)
        }
      })

      eventSource.onerror = (e) => {
        console.error('SSE Error:', e)
        eventSource?.close()
        eventSource = null

        if (retryCount >= MAX_RETRIES) {
          console.warn(`SSE: Reached max retries (${MAX_RETRIES}). Giving up.`)
          status.value = 'offline'
          return
        }

        status.value = 'error'

        const delay = Math.min(1000 * 2 ** retryCount, 30_000)
        console.warn(`SSE: Reconnecting in ${delay / 1000}s (attempt ${retryCount + 1}/${MAX_RETRIES})...`)
        retryCount++
        retryTimeout = setTimeout(connectSSE, delay)
      }
    })
  }

  onMounted(() => { connectSSE() })

  onUnmounted(() => {
    if (eventSource) { eventSource.close(); eventSource = null }
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null }
    if (retryTimeout) { clearTimeout(retryTimeout); retryTimeout = null }
  })

  return { data, history, error, status }
}
