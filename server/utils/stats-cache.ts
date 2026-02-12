import { EventEmitter } from 'events'

// Interface for Stats
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
    timestamp: number
}

export interface StatsHistory {
    network: { rx: number, tx: number }
    cpu: number
    memory: number
    timestamp: number
}

class StatsCache extends EventEmitter {
    private _data: SystemStats | null = null
    // History limit: 1 hour (asumsi 1 update data per 2 detik = 1800 data)
    private _history: StatsHistory[] = []
    private readonly MAX_HISTORY = 1800

    get data() {
        return this._data
    }

    set data(value: SystemStats | null) {
        this._data = value
        if (value) {
            this._history.push({
                network: { rx: value.network.rx_sec, tx: value.network.tx_sec },
                cpu: value.cpu.load,
                memory: value.memory.percent,
                timestamp: value.timestamp || Date.now()
            })

            if (this._history.length > this.MAX_HISTORY) {
                this._history.shift()
            }

            const oneHourAgo = Date.now() - (60 * 60 * 1000)
            if (this._history.length > 0 && this._history[0].timestamp < oneHourAgo) {
                this._history = this._history.filter(h => h.timestamp >= oneHourAgo)
            }

            this.emit('update', value)
        }
    }

    get history() {
        return this._history
    }

    get activeListeners(): number {
        return this.listenerCount('update')
    }
}

// Singleton instance
export const statsCache = new StatsCache()
