<script setup lang="ts">
import { useIntervalFn } from '@vueuse/core'

interface Container {
  id: string
  name: string
  image: string
  state: string
  status: string
  stack: string
}

const { data: containers, refresh, error } = await useFetch<Container[]>('/api/docker/containers', {
  key: 'docker-list',
})

// Auto refresh tiap 1 jam
useIntervalFn(() => {
  refresh()
}, 60 * 60 * 1000)

const activeCount = computed(() => {
  return containers.value?.filter(c => c.state === 'running').length || 0
})

function getStateColor(state: string) {
  switch (state) {
    case 'running': return 'bg-emerald-500'
    case 'exited': return 'bg-slate-500'
    case 'restarting': return 'bg-amber-500'
    default: return 'bg-red-500'
  }
}

function getStateRingColor(state: string) {
   switch (state) {
    case 'running': return 'ring-emerald-500/30'
    case 'exited': return 'ring-slate-500/30'
    case 'restarting': return 'ring-amber-500/30'
    default: return 'ring-red-500/30'
  }
}
</script>

<template>
   <Card class="w-full h-full flex flex-col bg-linear-to-t from-card to-card/50 shadow-lg border-primary/10 overflow-hidden">
      <CardHeader class="flex flex-row items-center justify-between pb-4">
         <div class="space-y-1">
            <CardTitle class="text-xl font-bold tracking-tight">
               Docker Health
            </CardTitle>
            <CardDescription class="text-sm text-muted-foreground">
               Container status & health
            </CardDescription>
         </div>
         <div class="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-primary/5">
            <span class="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            <span class="text-xs font-semibold text-foreground">{{ activeCount }} Active</span>
         </div>
      </CardHeader>

      <CardContent class="flex-1 overflow-y-auto min-h-[300px] pr-2 space-y-3 scrollbar-thin scrollbar-track-secondary/20 scrollbar-thumb-primary/20">
         
         <div v-if="error" class="flex flex-col items-center justify-center py-10 text-center text-destructive space-y-2">
            <Icon name="i-lucide-alert-triangle" class="size-8" />
            <div class="text-sm font-medium">Docker Socket Unreachable</div>
            <span class="text-xs text-muted-foreground">Ensure /var/run/docker.sock is mounted</span>
         </div>

         <template v-else>
            <div
               v-for="c in containers" :key="c.id"
               class="group relative overflow-hidden rounded-xl border border-primary/5 bg-secondary/20 hover:bg-secondary/40 transition-all duration-300"
            >
               <div class="flex items-center gap-4 p-3">
                  <!-- Status Indicator -->
                  <div class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-background/50 ring-1" :class="getStateRingColor(c.state)">
                     <div class="h-2.5 w-2.5 rounded-full" :class="getStateColor(c.state)" />
                  </div>

                  <!-- Info -->
                  <div class="flex-1 min-w-0">
                     <div class="flex items-center justify-between mb-0.5">
                        <h3 class="font-bold text-sm text-foreground truncate pr-2 group-hover:text-primary transition-colors">
                           {{ c.name }}
                        </h3>
                        <span class="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/70 bg-background/50 px-1.5 py-0.5 rounded">
                           {{ c.stack }}
                        </span>
                     </div>
                     
                     <div class="flex items-center justify-between text-xs text-muted-foreground">
                        <span class="truncate font-mono opacity-80 max-w-[180px]" :title="c.image">{{ c.image }}</span>
                        <span class="italic opacity-60 ml-2 whitespace-nowrap">{{ c.status }}</span>
                     </div>
                  </div>
               </div>
               
               <!-- Hover sidebar accent -->
               <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/50 transition-all duration-300"></div>
            </div>
         </template>

      </CardContent>
   </Card>
</template>
