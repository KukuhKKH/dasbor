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
}

class StatsCache extends EventEmitter {
    private _data: SystemStats | null = null

    get data() {
        return this._data
    }

    set data(value: SystemStats | null) {
        this._data = value
        if (value) {
            this.emit('update', value)
        }
    }
}

// Singleton instance
export const statsCache = new StatsCache()
