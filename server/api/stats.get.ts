import { statsCache } from '../utils/stats-cache'

export default defineEventHandler(() => {
   if (!statsCache.data) {
      return {
         os: {
            distro: 'Loading...',
            release: '',
            arch: '',
            hostname: 'Loading...'
         },
         cpu: {
            load: 0,
            cores: 0
         },
         memory: {
            total: 0,
            used: 0,
            percent: 0
         },
         storage: {
            total: 0,
            used: 0,
            percent: 0
         },
         network: {
            rx_sec: 0,
            tx_sec: 0
         },
         status: 'initializing'
      }
   }
   return statsCache.data
})
