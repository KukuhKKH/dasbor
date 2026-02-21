import { EventEmitter } from 'events'

// ─── Interfaces ───────────────────────────────────────────────────────────────

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
  timestamp: number
}

export interface StatsHistory {
  network: { rx: number; tx: number }
  cpu: number
  memory: number
  timestamp: number
}

export interface AlertEvent {
  id: string // unique per alert type untuk cooldown
  type: 'cpu' | 'memory' | 'storage'
  level: 'warning' | 'critical'
  value: number
  threshold: number
  timestamp: number
}

// ─── Alert Thresholds ─────────────────────────────────────────────────────────

const ALERT_THRESHOLDS = {
  cpu:     { warning: 85, critical: 95 },
  memory:  { warning: 80, critical: 90 },
  storage: { warning: 85, critical: 95 },
} as const

const ALERT_COOLDOWN_MS = 5 * 60 * 1000 // 5 menit per alert type

// ─── StatsCache ───────────────────────────────────────────────────────────────

class StatsCache extends EventEmitter {
  private _data: SystemStats | null = null
  // History limit: 1 jam (asumsi 1 update per 2 detik = 1800 data)
  private _history: StatsHistory[] = []
  private readonly MAX_HISTORY = 1800
  // Cooldown tracker per alert type+level
  private _alertCooldowns = new Map<string, number>()

  get data() {
    return this._data
  }

  set data(value: SystemStats | null) {
    this._data = value
    if (value) {
      this._history.push({
        network: { rx: value.network.rx_sec, tx: value.network.tx_sec },
        cpu:     value.cpu.load,
        memory:  value.memory.percent,
        timestamp: value.timestamp || Date.now(),
      })

      if (this._history.length > this.MAX_HISTORY) {
        this._history.shift()
      }

      const oneHourAgo = Date.now() - 60 * 60 * 1000
      if (this._history.length > 0 && this._history[0]!.timestamp < oneHourAgo) {
        this._history = this._history.filter(h => h.timestamp >= oneHourAgo)
      }

      this.emit('update', value)
      this._checkAlerts(value)
    }
  }

  get history() {
    return this._history
  }

  get activeListeners(): number {
    return this.listenerCount('update')
  }

  private _checkAlerts(data: SystemStats) {
    const checks: { type: AlertEvent['type']; value: number }[] = [
      { type: 'cpu',     value: data.cpu.load },
      { type: 'memory',  value: data.memory.percent },
      { type: 'storage', value: data.storage.percent },
    ]

    const now = Date.now()

    for (const { type, value } of checks) {
      const thresholds = ALERT_THRESHOLDS[type]
      let level: AlertEvent['level'] | null = null

      if (value >= thresholds.critical) {
        level = 'critical'
      } else if (value >= thresholds.warning) {
        level = 'warning'
      }

      if (!level) continue

      const cooldownKey = `${type}:${level}`
      const lastAlertAt = this._alertCooldowns.get(cooldownKey) ?? 0

      if (now - lastAlertAt < ALERT_COOLDOWN_MS) continue

      this._alertCooldowns.set(cooldownKey, now)

      const alert: AlertEvent = {
        id: cooldownKey,
        type,
        level,
        value: Math.round(value),
        threshold: level === 'critical' ? thresholds.critical : thresholds.warning,
        timestamp: now,
      }

      this.emit('alert', alert)
    }
  }
}

// Singleton instance
export const statsCache = new StatsCache()
