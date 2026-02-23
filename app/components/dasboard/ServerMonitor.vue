<script setup lang="ts">
import type { NetworkStats } from '~/types/dashboard'
import { useIntervalFn } from '@vueuse/core'

const { data, refresh, status } = await useFetch<NetworkStats>('/api/network', {
  key: 'network-stats',
  lazy: true,
  server: false
})

const uptimeSeconds = ref(0)

watch(data, (newVal) => {
  if (newVal && newVal.uptime?.seconds) {
    uptimeSeconds.value = newVal.uptime.seconds
  }
}, { immediate: true })

// Count up every second
useIntervalFn(() => {
  uptimeSeconds.value++
}, 1000)

// Auto-refresh every 15 minutes
useIntervalFn(() => refresh(), 15 * 60 * 1000)

function formatUptime(seconds: number) {
  const d = Math.floor(seconds / 86400)
  const h = Math.floor((seconds % 86400) / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (d > 0) {
    return `${d}d ${h}h ${m}m ${s}s`
  }

  return `${h}h ${m}m ${s}s`
}
</script>

<template>
  <Card
    class="w-full bg-linear-to-t from-card to-card/50 shadow-lg border-primary/10"
  >
    <CardHeader
      class="flex flex-row items-center justify-between space-y-0 pb-8"
    >
      <div class="space-y-1">
        <CardTitle class="text-xl font-bold tracking-tight">
          Infrastructure Monitor
        </CardTitle>
        <CardDescription class="text-sm text-muted-foreground">
          Real-time server and network health metrics
        </CardDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        class="rounded-full px-4 min-h-[44px] hover:bg-primary hover:text-primary-foreground transition-all duration-300"
        @click="refresh()"
      >
        <Icon name="i-lucide-refresh-cw" class="mr-2 size-4" />
        Sync Now
      </Button>
    </CardHeader>

    <CardContent class="grid gap-8">
      <div v-if="status === 'pending'" class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 animate-pulse mb-8">
        <div v-for="i in 4" :key="'ts-'+i" class="flex flex-col gap-1.5">
          <div class="h-3 w-24 bg-muted rounded"></div>
          <div class="h-8 w-32 bg-muted/60 rounded mt-1"></div>
          <div class="h-3 w-20 bg-muted/40 rounded mt-1"></div>
        </div>
      </div>

      <!-- Top Row: Primary Stats -->
      <div v-else class="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div class="flex flex-col gap-1.5">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
          >
            Server Uptime
          </span>
          <span class="text-xl md:text-2xl font-bold tabular-nums text-primary">
            {{ data?.uptime ? formatUptime(uptimeSeconds) : "---" }}
          </span>
          <span class="text-[10px] text-muted-foreground italic">
            Started:
            {{
              data?.uptime?.since
                ? new Date(data.uptime.since).toLocaleString()
                : "---"
            }}
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
          >
            Network Latency
          </span>
          <div class="flex items-baseline gap-1">
            <span class="text-xl md:text-2xl font-bold tabular-nums text-primary">
              {{ data?.network?.latency_ms ?? "---" }}
            </span>
            <span class="text-sm font-medium text-muted-foreground">ms</span>
          </div>
          <span class="text-[10px] text-muted-foreground italic">
            Gateway round-trip
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
          >
            Internal Gateway
          </span>
          <span class="text-2xl font-bold truncate text-primary">
            {{ data?.network?.gateway_ip ?? "---" }}
          </span>
          <span class="text-[10px] text-muted-foreground italic">
            Local route interface
          </span>
        </div>

        <div class="flex flex-col gap-1.5">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
          >
            Public Identity
          </span>
          <span class="text-2xl font-bold truncate text-primary">
            {{ data?.concentrator?.ip ?? "---" }}
          </span>
          <span class="text-[10px] text-muted-foreground italic">
            {{ data?.concentrator?.isp }}
          </span>
        </div>
      </div>

      <Separator class="bg-primary/5" />

      <div v-if="status === 'pending'" class="grid grid-cols-1 gap-8 md:grid-cols-3 animate-pulse mt-8">
        <div v-for="i in 3" :key="'bs-'+i" class="flex items-center gap-4">
          <div class="p-3 rounded-xl bg-muted size-11 shrink-0"></div>
          <div class="flex flex-col w-full gap-2">
            <div class="h-3 w-20 bg-muted rounded"></div>
            <div class="h-4 w-32 bg-muted/60 rounded"></div>
          </div>
        </div>
      </div>

      <!-- Bottom Row: Detailed Context -->
      <div v-else class="grid grid-cols-1 gap-8 md:grid-cols-3">
        <div class="flex items-center gap-4 group">
          <div
            class="p-3 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors"
          >
            <Icon name="i-lucide-building-2" class="size-5 text-primary" />
          </div>
          <div class="flex flex-col">
            <span
              class="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground"
            >
              Provider
            </span>
            <span class="text-sm font-semibold truncate">
              {{ data?.concentrator?.isp ?? "---" }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-4 group">
          <div
            class="p-3 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors"
          >
            <Icon name="i-lucide-network" class="size-5 text-primary" />
          </div>
          <div class="flex flex-col">
            <span
              class="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground"
            >
              Network ASN
            </span>
            <span class="text-sm font-semibold">
              {{ data?.concentrator?.asn ?? "---" }}
            </span>
          </div>
        </div>

        <div class="flex items-center gap-4 group">
          <div
            class="p-3 rounded-xl bg-primary/5 group-hover:bg-primary/10 transition-colors"
          >
            <Icon name="i-lucide-map-pin" class="size-5 text-primary" />
          </div>
          <div class="flex flex-col">
            <span
              class="text-[10px] font-bold uppercase tracking-tighter text-muted-foreground"
            >
              Data Center Location
            </span>
            <span class="text-sm font-semibold">
              {{ data?.concentrator?.region ?? "---" }}
            </span>
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
