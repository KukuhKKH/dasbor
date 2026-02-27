<script setup lang="ts">
import { useIntervalFn, useDocumentVisibility } from "@vueuse/core";
import { toast } from 'vue-sonner'

interface Container {
  id: string;
  full_id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: any[];
  labels: Record<string, string>;
  stats: any; // Fallback
}

type PendingAction =
  | { type: 'action'; id: string; action: string }
  | { type: 'logs'; id: string; name: string }

type StateFilter = 'all' | 'running' | 'exited' | 'restarting' | 'paused'

// 1. Fetch Lightweight List API
const { data: containers, refresh, status } = await useFetch<Container[]>(
  "/api/docker/containers?stats=0",
  { key: "docker-list", lazy: true, server: false, default: () => [] }
);

useIntervalFn(() => refresh(), 60000);

// 2. Expand/Collapse State
const expandedIds = ref<Set<string>>(new Set());

function toggleExpand(fullId: string) {
  const newSet = new Set(expandedIds.value);
  if (newSet.has(fullId)) {
    newSet.delete(fullId);
  } else {
    newSet.add(fullId);
    if (!statsMap.value[fullId]) {
      statsLoading.value.add(fullId);
      setTimeout(fetchDockerStats, 50);
    }
  }
  expandedIds.value = newSet;
}

// 3. Search & Filter (Debounced)
const searchQuery = ref("")
const debouncedQuery = ref("")
let searchTimeout: any = null

watch(searchQuery, (val) => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    debouncedQuery.value = val.trim().toLowerCase()
  }, 200)
})

onUnmounted(() => {
  if (searchTimeout) clearTimeout(searchTimeout)
})

const stateFilter = ref<StateFilter>("all")

const STATE_FILTERS: { label: string; value: StateFilter }[] = [
  { label: "All",        value: "all" },
  { label: "Running",    value: "running" },
  { label: "Exited",     value: "exited" },
  { label: "Restarting", value: "restarting" },
  { label: "Paused",     value: "paused" },
]

// Pre-compute normalized data
const normalizedContainers = computed(() => {
  const list = containers.value ?? []
  return list.map(c => ({
    ...c,
    _searchStr: (c.name + ' ' + c.image).toLowerCase()
  }))
})

const filteredContainers = computed(() => {
  let list = normalizedContainers.value
  if (stateFilter.value !== "all") {
    list = list.filter((c) => c.state === stateFilter.value)
  }
  if (debouncedQuery.value) {
    list = list.filter((c) => c._searchStr.includes(debouncedQuery.value))
  }
  return list
})

const stateCounts = computed(() => {
  const all = containers.value ?? []
  return {
    all: all.length,
    running:    all.filter(c => c.state === "running").length,
    exited:     all.filter(c => c.state === "exited").length,
    restarting: all.filter(c => c.state === "restarting").length,
    paused:     all.filter(c => c.state === "paused").length,
  }
})

const activeCount = computed(() =>
  containers.value?.filter((c) => c.state === "running").length || 0
)

const STATS_POLLING_LIMIT = 50;
const statsIdsToFetch = computed(() => {
  return filteredContainers.value
    .filter(c => c.state === 'running' && expandedIds.value.has(c.full_id))
    .slice(0, STATS_POLLING_LIMIT)
    .map(c => c.full_id)
})

// 4. Client-side Stats Polling Map
const statsMap = ref<Record<string, any>>({});
const statsLoading = ref<Set<string>>(new Set());

const fetchDockerStats = async () => {
  const ids = statsIdsToFetch.value;
  if (ids.length === 0) return;

  try {
    const idsParam = ids.join(',');
    const newStats = await $fetch<Record<string, any>>(`/api/docker/containers/stats?ids=${idsParam}`);
    
    statsMap.value = {
      ...statsMap.value,
      ...newStats
    };

    ids.forEach(id => {
      if (statsLoading.value.has(id)) {
        statsLoading.value.delete(id);
      }
    });
  } catch (e: any) {
    console.warn("Failed to fetch Docker stats:", e?.message);
  }
};

const isVisible = useDocumentVisibility();

useIntervalFn(() => {
  if (isVisible.value === 'visible') {
    fetchDockerStats();
  }
}, 5000);

function getStats(c: Container) {
  const mapStats = statsMap.value[c.full_id];
  if (mapStats && Object.keys(mapStats).length > 0) return mapStats;
  if (c.stats && Object.keys(c.stats).length > 0) return c.stats;

  return {
    cpu_percent: 0,
    mem_usage: 0,
    mem_limit: 0,
    mem_percent: 0,
    net_rx: 0,
    net_tx: 0,
    blk_read: 0,
    blk_write: 0,
    limits: { memory: 0, memory_reservation: 0, cpu: 0 }
  };
}

const STATE_STYLES: Record<string, { dot: string; ring: string }> = {
  running:    { dot: "bg-emerald-500", ring: "ring-emerald-500/30" },
  exited:     { dot: "bg-slate-500",   ring: "ring-slate-500/30" },
  restarting: { dot: "bg-amber-500",   ring: "ring-amber-500/30" },
  paused:     { dot: "bg-yellow-400",  ring: "ring-yellow-400/30" },
};

function getStateStyle(state: string) {
  return STATE_STYLES[state] ?? { dot: "bg-red-500", ring: "ring-red-500/30" };
}

function getStack(c: Container) {
  return c.labels?.["com.docker.stack.namespace"] || "Standalone";
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(1)} ${sizes[i]}`;
}

// Actions & Auth
const authOpen = ref(false)
const pendingAction = ref<PendingAction | null>(null)
const isAuthenticated = useCookie('docker_is_authenticated')

function handleAction(id: string, action: string) {
  if (isAuthenticated.value) {
    executeAction(id, action)
  } else {
    pendingAction.value = { type: 'action', id, action }
    authOpen.value = true
  }
}

const logsOpen = ref(false)
const selectedContainer = ref<{ id: string, name: string } | null>(null)

function handleViewLogs(c: Container) {
  if (isAuthenticated.value) {
    selectedContainer.value = { id: c.id, name: c.name }
    logsOpen.value = true
  } else {
    pendingAction.value = { type: 'logs', id: c.id, name: c.name }
    authOpen.value = true
  }
}

function onAuthenticated() {
  if (pendingAction.value) {
    if (pendingAction.value.type === 'logs') {
      selectedContainer.value = { id: pendingAction.value.id, name: pendingAction.value.name }
      logsOpen.value = true
    } else {
      executeAction(pendingAction.value.id, pendingAction.value.action)
    }
    pendingAction.value = null
  }
}

async function executeAction(id: string, action: string, opts?: Record<string, string>) {
  try {
    toast.info(`Executing ${action}...`)
    const query = opts ? '?' + new URLSearchParams(opts).toString() : ''
    await $fetch(`/api/docker/${id}/${action}${query}`, { method: 'POST' })
    toast.success(`Container ${action}ed successfully`)
    refresh()
  } catch (e: any) {
    toast.error(e.data?.statusMessage || `Failed to ${action} container`)
  }
}

// Remove dialog
const removeDialogOpen = ref(false)
const containerToRemove = ref<{ id: string; name: string; running: boolean } | null>(null)

function handleRemove(c: Container) {
  if (isAuthenticated.value) {
    containerToRemove.value = { id: c.id, name: c.name, running: c.state === 'running' }
    removeDialogOpen.value = true
  } else {
    pendingAction.value = { type: 'action', id: c.id, action: 'remove' }
    authOpen.value = true
  }
}

async function confirmRemove(force = false) {
  if (!containerToRemove.value) return
  removeDialogOpen.value = false
  await executeAction(containerToRemove.value.id, 'remove', force ? { force: 'true' } : undefined)
  containerToRemove.value = null
}

// Redeploy
const redeployingIds = ref<Set<string>>(new Set())

function handleRedeploy(c: Container) {
  if (isAuthenticated.value) {
    executeRedeploy(c)
  } else {
    pendingAction.value = { type: 'action', id: c.id, action: 'redeploy' }
    authOpen.value = true
  }
}

async function executeRedeploy(c: Container) {
  const isSwarm = !!c.labels?.['com.docker.swarm.service.id']

  redeployingIds.value = new Set([...redeployingIds.value, c.id])

  const strategyMsg = isSwarm
    ? 'Pulling image & updating Swarm service...'
    : 'Pulling image & restarting container...'

  toast.info(strategyMsg, { duration: 20_000, id: `redeploy-${c.id}` })

  try {
    const result = await $fetch<{ success: boolean; strategy: string; image: string }>(
      `/api/docker/${c.id}/redeploy`,
      { method: 'POST' },
    )

    const doneMsg = result.strategy === 'swarm-service-update'
      ? `✅ Service updated — rolling update started for ${c.name}`
      : `✅ Redeployed — ${c.name} restarted with latest image`

    toast.success(doneMsg, { id: `redeploy-${c.id}`, duration: 8_000 })
    setTimeout(refresh, 3000)
  } catch (e: any) {
    toast.error(e.data?.statusMessage || `Redeploy failed for ${c.name}`, {
      id: `redeploy-${c.id}`,
    })
  } finally {
    const next = new Set(redeployingIds.value)
    next.delete(c.id)
    redeployingIds.value = next
  }
}

const redirectDialogOpen = ref(false)
const urlToRedirect = ref("")
const containerNameForRedirect = ref("")
const isSwarmForRedirect = ref(false)

function getTraefikUrl(labels: Record<string, string>) {
  const hostLabel = Object.keys(labels).find(k => k.startsWith('traefik.http.routers.') && k.endsWith('.rule'))
  if (!hostLabel) return null

  const rule = labels[hostLabel]
  const match = rule.match(/Host\(`([^`]+)`\)/)
  if (match && match[1]) {
    const host = match[1].split(',')[0].trim().replace(/`/g, '')
    
    const isLocal = host.endsWith('.test') || 
                    host.endsWith('.localhost') || 
                    host.endsWith('.local') ||
                    /^(\d{1,3}\.){3}\d{1,3}$/.test(host)
    
    const protocol = isLocal ? 'http' : 'https'
    return `${protocol}://${host}`
  }

  return null
}

function handleVisitSite(c: Container) {
  const url = getTraefikUrl(c.labels)
  if (url) {
    urlToRedirect.value = url
    containerNameForRedirect.value = c.name
    isSwarmForRedirect.value = !!c.labels?.['com.docker.swarm.service.id']
    redirectDialogOpen.value = true
  }
}

function confirmRedirect() {
  if (urlToRedirect.value) {
    window.open(urlToRedirect.value, '_blank')
    redirectDialogOpen.value = false
  }
}
</script>

<template>
  <Card
    class="w-full h-full flex flex-col min-h-0 bg-linear-to-t from-card to-card/50 shadow-lg border-primary/10 overflow-hidden"
  >
    <CardHeader class="flex flex-row items-center justify-between pb-3 shrink-0">
      <div class="space-y-1">
        <CardTitle class="text-xl font-bold tracking-tight">Docker Health</CardTitle>
        <CardDescription class="text-sm text-muted-foreground">
          Container status monitor
        </CardDescription>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-primary/5">
          <span class="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span class="text-xs font-semibold text-foreground">{{ activeCount }} Active</span>
        </div>
        <Button variant="outline" size="icon" class="h-10 w-10 rounded-full" @click="refresh()">
          <Icon name="i-lucide-refresh-cw" class="size-4" />
        </Button>
      </div>
    </CardHeader>

    <div class="px-6 pb-3 space-y-2 shrink-0">
      <div class="flex items-center gap-2 rounded-lg bg-secondary/30 border border-primary/5 px-3 py-2 focus-within:border-primary/20 focus-within:bg-secondary/50 transition-all">
        <Icon name="i-lucide-search" class="size-3.5 text-muted-foreground/50 shrink-0" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Cari nama atau image..."
          class="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/40 text-foreground min-h-[28px]"
        />
        <button
          v-if="searchQuery"
          class="p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
          @click="searchQuery = ''"
        >
          <Icon name="i-lucide-x" class="size-3.5" />
        </button>
      </div>

      <div class="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
        <button
          v-for="f in STATE_FILTERS"
          :key="f.value"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-all duration-200 whitespace-nowrap shrink-0"
          :class="stateFilter === f.value
            ? 'bg-primary/10 border-primary/30 text-primary'
            : 'bg-secondary/20 border-transparent text-muted-foreground hover:border-primary/15 hover:text-foreground active:bg-secondary/40'"
          @click="stateFilter = f.value"
        >
          <span
            v-if="f.value !== 'all'"
            class="h-1.5 w-1.5 rounded-full shrink-0"
            :class="{
              'bg-emerald-500': f.value === 'running',
              'bg-slate-400':   f.value === 'exited',
              'bg-amber-500':   f.value === 'restarting',
              'bg-yellow-400':  f.value === 'paused',
            }"
          />
          {{ f.label }}
          <span
            class="font-mono text-[10px]"
            :class="stateFilter === f.value ? 'text-primary' : 'text-muted-foreground/50'"
          >
            {{ stateCounts[f.value] }}
          </span>
        </button>
      </div>
    </div>

    <!-- MAIN LIST CONTENT -->
    <!-- min-h-0 and flex-1 allows inner scrolling independently -->
    <CardContent
      class="flex-1 min-h-0 overflow-y-auto px-6 pb-6 space-y-3 scrollbar-thin scrollbar-track-secondary/20 scrollbar-thumb-primary/20"
    >
      <!-- Loading Skeleton Stack -->
      <div v-if="status === 'pending' && (!containers || containers.length === 0)" class="space-y-3">
        <div v-for="i in 8" :key="'skel-'+i" class="rounded-xl border border-primary/5 bg-secondary/10 p-3 h-[72px] flex items-center gap-3 animate-pulse">
          <div class="h-9 w-9 rounded-lg bg-muted shrink-0"></div>
          <div class="flex-1 space-y-2">
            <div class="h-3 w-32 bg-muted rounded"></div>
            <div class="h-2 w-48 bg-muted/60 rounded"></div>
          </div>
        </div>
      </div>

      <div
        v-else-if="!containers || containers.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center space-y-3"
      >
        <div class="p-4 rounded-full bg-secondary/50">
          <Icon name="i-lucide-container" class="size-8 text-muted-foreground/50" />
        </div>
        <div class="space-y-1">
          <div class="text-sm font-medium text-muted-foreground">No Containers Found</div>
          <p class="text-xs text-muted-foreground/60 max-w-[200px]">
            Docker might be offline or socket is not accessible.
          </p>
        </div>
        <Button variant="outline" size="sm" class="rounded-full min-h-[44px] px-5" @click="refresh()">
          Retry Connection
        </Button>
      </div>

      <div
        v-else-if="filteredContainers.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center space-y-3"
      >
        <div class="p-4 rounded-full bg-secondary/50">
          <Icon name="i-lucide-search-x" class="size-8 text-muted-foreground/40" />
        </div>
        <div class="space-y-1">
          <div class="text-sm font-medium text-muted-foreground">Tidak ada hasil</div>
          <p class="text-xs text-muted-foreground/50 max-w-[200px]">
            Coba ubah kata kunci atau filter state.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          class="rounded-full text-xs min-h-[44px] px-5"
          @click="searchQuery = ''; stateFilter = 'all'"
        >
          <Icon name="i-lucide-x" class="mr-1.5 size-3" />
          Reset Filter
        </Button>
      </div>

      <template v-else>
        <div
          v-if="searchQuery || stateFilter !== 'all'"
          class="flex items-center justify-between text-[10px] text-muted-foreground/50 px-1 mb-2 shrink-0"
        >
          <span>Menampilkan {{ filteredContainers.length }} dari {{ containers?.length }} container</span>
          <button
            class="hover:text-foreground transition-colors underline underline-offset-2 min-h-[36px] px-2"
            @click="searchQuery = ''; stateFilter = 'all'"
          >
            Reset
          </button>
        </div>

        <component
          :is="filteredContainers.length > 30 ? 'div' : 'TransitionGroup'"
          tag="div"
          class="space-y-3"
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition-all duration-150 ease-in absolute w-full"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-for="c in filteredContainers"
            :key="c.full_id"
            class="group relative overflow-hidden rounded-xl border border-primary/5 bg-secondary/10 hover:bg-secondary/30 transition-all duration-300"
          >
            <div class="flex flex-col p-3 gap-3">
              <div class="flex items-center gap-3">
                <div
                  class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/50 ring-1"
                  :class="getStateStyle(c.state).ring"
                >
                  <div class="h-2 w-2 rounded-full" :class="getStateStyle(c.state).dot" />
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-0.5">
                    <h3 class="font-bold text-sm text-foreground truncate pr-2 group-hover:text-primary transition-colors">
                      {{ c.name }}
                    </h3>
                    <div class="flex items-center gap-1">
                      <span class="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/60 bg-background/40 px-1.5 py-0.5 rounded mr-1">
                        {{ getStack(c) }}
                      </span>
                      
                      <!-- Visit Site Quick Button -->
                      <Button
                        v-if="getTraefikUrl(c.labels)"
                        variant="ghost" 
                        size="icon" 
                        class="h-8 w-8 rounded-full hover:bg-background/80 text-primary"
                        title="Visit Site"
                        @click="handleVisitSite(c)"
                      >
                        <Icon name="i-lucide-external-link" class="size-4" />
                      </Button>

                      <!-- Expand Toggle (Show only if running) -->
                      <Button
                        v-if="c.state === 'running'"
                        variant="ghost" 
                        size="icon" 
                        class="h-8 w-8 rounded-full hover:bg-background/80"
                        @click="toggleExpand(c.full_id)"
                      >
                        <Icon 
                          :name="expandedIds.has(c.full_id) ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" 
                          class="size-4 text-muted-foreground transition-transform duration-200" 
                        />
                      </Button>

                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button variant="ghost" size="icon" class="h-8 w-8 rounded-full hover:bg-background/80">
                            <Icon name="i-lucide-more-vertical" class="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem
                            v-if="getTraefikUrl(c.labels)"
                            class="py-2.5 cursor-pointer text-primary focus:text-primary font-medium"
                            @click="handleVisitSite(c)"
                          >
                            <Icon name="i-lucide-external-link" class="mr-2 size-4" />
                            Visit Site
                          </DropdownMenuItem>
                          <DropdownMenuSeparator v-if="getTraefikUrl(c.labels)" />
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleViewLogs(c)">
                            <Icon name="i-lucide-file-text" class="mr-2 size-4" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleAction(c.id, 'start')" :disabled="c.state === 'running' || c.state === 'paused'">
                            <Icon name="i-lucide-play" class="mr-2 size-4" />
                            Start
                          </DropdownMenuItem>
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleAction(c.id, 'stop')" :disabled="c.state !== 'running' && c.state !== 'paused'">
                            <Icon name="i-lucide-square" class="mr-2 size-4" />
                            Stop
                          </DropdownMenuItem>
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleAction(c.id, 'restart')" :disabled="c.state !== 'running'">
                            <Icon name="i-lucide-rotate-cw" class="mr-2 size-4" />
                            Restart
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="c.state === 'running'"
                            class="py-2.5 cursor-pointer text-yellow-500 focus:text-yellow-500"
                            @click="handleAction(c.id, 'pause')"
                          >
                            <Icon name="i-lucide-pause" class="mr-2 size-4" />
                            Pause
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            v-if="c.state === 'paused'"
                            class="py-2.5 cursor-pointer text-emerald-500 focus:text-emerald-500"
                            @click="handleAction(c.id, 'unpause')"
                          >
                            <Icon name="i-lucide-play-circle" class="mr-2 size-4" />
                            Unpause
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            class="py-2.5 cursor-pointer text-sky-500 focus:text-sky-500"
                            :disabled="redeployingIds.has(c.id)"
                            @click="handleRedeploy(c)"
                          >
                            <Icon
                              :name="redeployingIds.has(c.id) ? 'i-lucide-loader-2' : 'i-lucide-rocket'"
                              class="mr-2 size-4"
                              :class="{ 'animate-spin': redeployingIds.has(c.id) }"
                            />
                            <span>{{ redeployingIds.has(c.id) ? 'Deploying...' : 'Redeploy' }}</span>
                            <span
                              v-if="!redeployingIds.has(c.id)"
                              class="ml-auto text-[8px] font-semibold px-1 py-0.5 rounded bg-sky-500/10 text-sky-400"
                            >
                              {{ c.labels?.['com.docker.swarm.service.id'] ? 'Swarm' : 'Restart' }}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            class="py-2.5 cursor-pointer text-destructive focus:text-destructive"
                            @click="handleRemove(c)"
                          >
                            <Icon name="i-lucide-trash-2" class="mr-2 size-4" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div class="text-[10px] text-muted-foreground flex items-center justify-between">
                    <span class="truncate opacity-70">{{ c.image }}</span>
                    <span class="italic font-medium">{{ c.status }}</span>
                  </div>
                </div>
              </div>

              <!-- COLLAPSIBLE STATS SECTION -->
              <div 
                v-if="c.state === 'running' && expandedIds.has(c.full_id)" 
                class="grid grid-cols-2 gap-4 pt-1 border-t border-primary/5 animate-in fade-in slide-in-from-top-1 duration-200"
              >
                <!-- Loading State skeleton -->
                <div v-if="statsLoading.has(c.full_id)" class="col-span-2 grid grid-cols-2 gap-4 mt-2 mb-1">
                  <div class="space-y-2 animate-pulse">
                    <div class="flex justify-between">
                      <div class="h-2 w-8 bg-muted rounded"></div>
                      <div class="h-2 w-8 bg-muted rounded"></div>
                    </div>
                    <div class="h-1.5 w-full bg-muted/50 rounded-full"></div>
                  </div>
                  <div class="space-y-2 animate-pulse">
                    <div class="flex justify-between">
                      <div class="h-2 w-8 bg-muted rounded"></div>
                      <div class="h-2 w-12 bg-muted rounded"></div>
                    </div>
                    <div class="h-1.5 w-full bg-muted/50 rounded-full"></div>
                  </div>
                </div>

                <template v-else>
                  <!-- CPU -->
                  <div class="space-y-1.5">
                    <div class="flex justify-between text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/80">
                      <div class="flex items-center gap-1">
                        <span>CPU</span>
                        <span v-if="getStats(c).limits?.cpu" class="text-[8px] font-normal opacity-70 normal-case bg-primary/5 px-1 rounded">
                          Max {{ getStats(c).limits?.cpu }}
                        </span>
                        <Icon v-else name="i-lucide-alert-triangle" class="size-3 text-amber-500/70" title="No CPU Limit Set" />
                      </div>
                      <span class="text-primary">{{ getStats(c).cpu_percent }}%</span>
                    </div>
                    <div class="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-primary transition-all duration-500 rounded-full"
                        :style="{ width: `${Math.min(getStats(c).cpu_percent, 100)}%` }"
                      />
                    </div>
                  </div>

                  <!-- Memory -->
                  <div class="space-y-1.5">
                    <div class="flex justify-between text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/80">
                      <div class="flex items-center gap-1">
                        <span>RAM</span>
                        <Icon v-if="!getStats(c).limits?.memory" name="i-lucide-alert-triangle" class="size-3 text-amber-500/70" title="No Memory Limit Set" />
                      </div>
                      <span class="text-purple-400">{{ formatBytes(getStats(c).mem_usage) }}</span>
                    </div>
                    <div class="h-1.5 w-full bg-purple-500/10 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-purple-500 transition-all duration-500 rounded-full"
                        :style="{ width: `${getStats(c).mem_percent}%` }"
                      />
                    </div>
                    <div class="flex items-center justify-between text-[8px] text-muted-foreground/60 font-medium whitespace-nowrap overflow-hidden">
                      <span class="truncate mr-2">Min: {{ getStats(c).limits?.memory_reservation ? formatBytes(getStats(c).limits.memory_reservation) : '-' }}</span>
                      <span class="truncate text-right" :class="{'text-amber-500/80': !getStats(c).limits?.memory}">
                        Max: {{ getStats(c).limits?.memory ? formatBytes(getStats(c).limits.memory) : 'Host (Unsafe)' }}
                      </span>
                    </div>
                  </div>
                  
                  <!-- Network -->
                  <div class="col-span-2 flex items-center justify-between text-[9px] text-muted-foreground/50 font-mono mt-1 pt-1 border-t border-primary/5">
                    <div class="flex items-center gap-1">
                      <Icon name="i-lucide-arrow-down" class="size-2.5" />
                      {{ formatBytes(getStats(c).net_rx) }}
                    </div>
                    <div class="flex items-center gap-1">
                      <Icon name="i-lucide-arrow-up" class="size-2.5" />
                      {{ formatBytes(getStats(c).net_tx) }}
                    </div>
                  </div>
                </template>

              </div>

            </div>

            <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/50 transition-all duration-300" />
          </div>
        </component>
      </template>
    </CardContent>

    <DockerAuthModal v-model:open="authOpen" @authenticated="onAuthenticated" />
    <DockerLogsModal
      v-model:open="logsOpen"
      :container-id="selectedContainer?.id || null"
      :container-name="selectedContainer?.name"
    />

    <AlertDialog v-model:open="removeDialogOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle class="flex items-center gap-2 text-destructive">
            <Icon name="i-lucide-trash-2" class="size-5" />
            Remove Container
          </AlertDialogTitle>
          <AlertDialogDescription class="space-y-2">
            <p>
              Apakah kamu yakin ingin menghapus container
              <span class="font-bold text-foreground">{{ containerToRemove?.name }}</span>?
            </p>
            <p v-if="containerToRemove?.running" class="flex items-center gap-1.5 text-amber-500 font-medium text-sm">
              <Icon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
              Container sedang berjalan. Penghapusan paksa akan menghentikannya terlebih dahulu.
            </p>
            <p class="text-xs text-muted-foreground/70">Aksi ini tidak bisa dibatalkan.</p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            v-if="containerToRemove?.running"
            class="bg-amber-500 hover:bg-amber-600 text-white"
            @click="confirmRemove(true)"
          >
            <Icon name="i-lucide-zap" class="mr-1.5 size-4" />
            Force Remove
          </AlertDialogAction>
          <AlertDialogAction
            v-else
            class="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            @click="confirmRemove(false)"
          >
            <Icon name="i-lucide-trash-2" class="mr-1.5 size-4" />
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <DasboardDockerTraefikRedirectModal
      v-model:open="redirectDialogOpen"
      :url="urlToRedirect"
      :container-name="containerNameForRedirect"
      :is-swarm="isSwarmForRedirect"
    />
  </Card>
</template>
