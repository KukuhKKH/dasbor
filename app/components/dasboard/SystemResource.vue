<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

interface Stats {
  os: { distro: string, release: string, hostname: string, arch: string }
  cpu: { load: number, cores: number }
  memory: { total: number, used: number, percent: number }
  storage: { total: number, used: number, percent: number }
  network: { rx_sec: number, tx_sec: number }
}

const { data, refresh, error } = await useFetch<Stats>('/api/stats', {
  key: 'system-stats',
})

const netHistory = ref<{ rx: number, tx: number }[]>(Array(30).fill({ rx: 0, tx: 0 }))

// Auto-refresh tiap 2 detik
useIntervalFn(() => {
  refresh()
}, 2000)

watch(data, (newVal) => {
  if (newVal?.network) {
    netHistory.value.push({ rx: newVal.network.rx_sec, tx: newVal.network.tx_sec })
    if (netHistory.value.length > 30)
      netHistory.value.shift()
  }
})

// Helper: Format Bytes (GB, MB, KB)
function formatBytes(bytes: number) {
  if (bytes === 0)
    return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`
}

// Helper: Bikin Path SVG untuk Grafik
function createPath(dataKey: 'rx' | 'tx', height: number) {
  const points = netHistory.value.map((h, i) => {
    const maxVal = Math.max(...netHistory.value.map(v => v[dataKey]), 1024 * 10) 
    const x = i * (100 / 29) 
    const val = h[dataKey]
    const y = height - (val / maxVal) * height
    return `${x},${y}`
  })
  return `M0,${height} L${points.join(' L')} L100,${height} Z`
}
</script>

<template>
  <Card class="w-full bg-linear-to-t from-card to-card/50 shadow-lg border-primary/10">
    <CardHeader class="flex flex-row items-center justify-between space-y-0">
      <div class="space-y-1">
        <CardTitle class="text-xl font-bold tracking-tight">
          System Resources
        </CardTitle>
        <CardDescription class="text-sm text-muted-foreground">
          Live hardware utilization metrics
        </CardDescription>
      </div>
      <div class="flex items-center gap-2">
         <div v-if="error" class="flex items-center gap-2 text-destructive text-sm">
            <Icon name="i-lucide-alert-circle" class="size-4" />
            <span>Offline</span>
         </div>
         <div v-else class="flex items-center gap-2">
            <span class="relative flex h-2 w-2">
               <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
               <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span class="text-xs font-medium text-emerald-500">Live</span>
         </div>
      </div>
    </CardHeader>

    <CardContent class="grid gap-8">
      <!-- Host Info Header -->
      <div class="flex items-center justify-between rounded-xl bg-primary/5 p-4">
        <div class="flex items-center gap-4">
           <div class="p-2 rounded-lg bg-primary/10">
              <Icon name="i-lucide-monitor" class="size-5 text-primary" />
           </div>
           <div class="flex flex-col">
              <span class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">Hostname</span>
              <span class="text-sm font-semibold truncate max-w-[150px]">{{ data?.os.hostname || '---' }}</span>
           </div>
        </div>
        <div class="text-right">
           <span class="text-[10px] uppercase tracking-widest text-muted-foreground/80 block mb-0.5">System</span>
           <span class="text-xs font-medium bg-secondary px-2 py-1 rounded-md">{{ data?.os.distro || 'Unknown' }}</span>
        </div>
      </div>

      <!-- Resource Grid -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
         
         <!-- CPU & Mem & Storage Column -->
         <div class="space-y-6">
            <!-- CPU -->
            <div class="space-y-2">
               <div class="flex justify-between text-xs items-end">
                  <span class="font-bold text-muted-foreground">CPU LOAD ({{ data?.cpu.cores }} Cores)</span>
                  <span class="font-mono font-bold text-primary">{{ data?.cpu.load }}%</span>
               </div>
               <Progress :model-value="data?.cpu.load" class="h-2" :class="{'[&>div]:bg-red-500': (data?.cpu.load || 0) > 80}" />
            </div>

            <!-- Memory -->
            <div class="space-y-2">
               <div class="flex justify-between text-xs items-end">
                  <span class="font-bold text-muted-foreground">MEMORY</span>
                  <div class="flex gap-2">
                     <span class="text-muted-foreground">{{ formatBytes(data?.memory.used || 0) }} / {{ formatBytes(data?.memory.total || 0) }}</span>
                     <span class="font-mono font-bold text-primary">{{ data?.memory.percent }}%</span>
                  </div>
               </div>
               <Progress :model-value="data?.memory.percent" class="h-2 [&>div]:bg-purple-500" />
            </div>

            <!-- Storage -->
            <div class="space-y-2">
               <div class="flex justify-between text-xs items-end">
                  <span class="font-bold text-muted-foreground">STORAGE (Root)</span>
                  <span class="font-mono font-bold text-primary">{{ data?.storage.percent }}%</span>
               </div>
               <Progress :model-value="data?.storage.percent" class="h-2 [&>div]:bg-amber-500" />
            </div>
         </div>

         <!-- Network Graph Column -->
         <div class="flex flex-col rounded-xl border border-primary/10 bg-black/20 p-4 min-h-[180px]">
            <div class="mb-4 flex items-center justify-between">
               <span class="text-xs font-bold text-muted-foreground uppercase tracking-widest">Network Traffic</span>
               <div class="flex gap-3 text-xs font-mono">
                  <span class="text-emerald-400 flex items-center gap-1">
                     <Icon name="i-lucide-arrow-down" class="size-3" />
                     {{ formatBytes(data?.network.rx_sec || 0) }}/s
                  </span>
                  <span class="text-blue-400 flex items-center gap-1">
                     <Icon name="i-lucide-arrow-up" class="size-3" />
                     {{ formatBytes(data?.network.tx_sec || 0) }}/s
                  </span>
               </div>
            </div>

            <div class="relative flex-1 w-full overflow-hidden rounded bg-background/50">
               <svg class="absolute inset-0 h-full w-full" preserveAspectRatio="none" viewBox="0 0 100 50">
                  <path
                     :d="createPath('rx', 50)"
                     fill="rgba(52, 211, 153, 0.1)"
                     stroke="#34d399"
                     stroke-width="1"
                     class="transition-all duration-300 ease-in-out"
                  />
                  <path
                     :d="createPath('tx', 50)"
                     fill="rgba(96, 165, 250, 0.1)"
                     stroke="#60a5fa"
                     stroke-width="1"
                     class="transition-all duration-300 ease-in-out"
                  />
               </svg>
            </div>
         </div>

      </div>
    </CardContent>
  </Card>
</template>
