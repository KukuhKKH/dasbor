<script setup lang="ts">
import { useIntervalFn } from "@vueuse/core";
import { toast } from 'vue-sonner'

interface Container {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: any[];
  labels: Record<string, string>;
  stats: {
    cpu_percent: number;
    mem_usage: number;
    mem_limit: number;
    mem_percent: number;
    net_rx: number;
    net_tx: number;
    blk_read: number;
    blk_write: number;
    limits?: {
      memory: number;
      memory_reservation: number;
      cpu: number;
    };
  };
}

type PendingAction =
  | { type: 'action'; id: string; action: string }
  | { type: 'logs'; id: string; name: string }

type StateFilter = 'all' | 'running' | 'exited' | 'restarting'

const { data: containers, refresh } = await useFetch<Container[]>(
  "/api/docker/containers",
  { key: "docker-list", default: () => [] },
);

useIntervalFn(() => refresh(), 60000);

// Search & Filter
const searchQuery = ref("")
const stateFilter = ref<StateFilter>("all")

const STATE_FILTERS: { label: string; value: StateFilter }[] = [
  { label: "All",        value: "all" },
  { label: "Running",    value: "running" },
  { label: "Exited",     value: "exited" },
  { label: "Restarting", value: "restarting" },
]

const filteredContainers = computed(() => {
  let list = containers.value ?? []
  if (stateFilter.value !== "all") {
    list = list.filter((c) => c.state === stateFilter.value)
  }
  const q = searchQuery.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.image.toLowerCase().includes(q)
    )
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
  }
})

const activeCount = computed(() =>
  containers.value?.filter((c) => c.state === "running").length || 0
)

const STATE_STYLES: Record<string, { dot: string; ring: string }> = {
  running:    { dot: "bg-emerald-500", ring: "ring-emerald-500/30" },
  exited:     { dot: "bg-slate-500",   ring: "ring-slate-500/30" },
  restarting: { dot: "bg-amber-500",   ring: "ring-amber-500/30" },
};

function getStateStyle(state: string) {
  return STATE_STYLES[state] ?? { dot: "bg-red-500", ring: "ring-red-500/30" };
}

function getStack(c: Container) {
  return c.labels?.["com.docker.stack.namespace"] || "Standalone";
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
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

async function executeAction(id: string, action: string) {
  try {
    toast.info(`Executing ${action}...`)
    await $fetch(`/api/docker/${id}/${action}`, { method: 'POST' })
    toast.success(`Container ${action}ed successfully`)
    refresh()
  } catch (e: any) {
    toast.error(e.data?.statusMessage || `Failed to ${action} container`)
  }
}
</script>

<template>
  <Card
    class="w-full h-full flex flex-col bg-linear-to-t from-card to-card/50 shadow-lg border-primary/10 overflow-hidden"
  >
    <CardHeader class="flex flex-row items-center justify-between pb-3">
      <div class="space-y-1">
        <CardTitle class="text-xl font-bold tracking-tight">Docker Health</CardTitle>
        <CardDescription class="text-sm text-muted-foreground">
          Container status &amp; live metrics
        </CardDescription>
      </div>
      <div class="flex items-center gap-2">
        <div class="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-primary/5">
          <span class="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span class="text-xs font-semibold text-foreground">{{ activeCount }} Active</span>
        </div>
        <!-- FIX: h-10 w-10 = 40px, lebih mudah dipencet di mobile -->
        <Button variant="outline" size="icon" class="h-10 w-10 rounded-full" @click="refresh()">
          <Icon name="i-lucide-refresh-cw" class="size-4" />
        </Button>
      </div>
    </CardHeader>

    <!-- Search & Filter Bar -->
    <div class="px-6 pb-3 space-y-2">
      <!-- Search Input -->
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

      <!-- State Filter Chips — FIX: overflow-x-auto untuk mobile -->
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

    <CardContent
      class="flex-1 overflow-y-auto min-h-[300px] pr-2 space-y-3 scrollbar-thin scrollbar-track-secondary/20 scrollbar-thumb-primary/20"
    >
      <!-- Empty: tidak ada container -->
      <div
        v-if="!containers || containers.length === 0"
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

      <!-- Empty: filter tidak cocok -->
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

      <!-- Container List — FIX: TransitionGroup untuk animasi saat filter berubah -->
      <template v-else>
        <div
          v-if="searchQuery || stateFilter !== 'all'"
          class="flex items-center justify-between text-[10px] text-muted-foreground/50 px-1"
        >
          <span>Menampilkan {{ filteredContainers.length }} dari {{ containers?.length }} container</span>
          <button
            class="hover:text-foreground transition-colors underline underline-offset-2 min-h-[36px] px-2"
            @click="searchQuery = ''; stateFilter = 'all'"
          >
            Reset
          </button>
        </div>

        <TransitionGroup
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
            :key="c.id"
            class="group relative overflow-hidden rounded-xl border border-primary/5 bg-secondary/10 hover:bg-secondary/30 transition-all duration-300"
          >
            <div class="flex flex-col p-3 gap-3">
              <!-- Top info -->
              <div class="flex items-center gap-3">
                <!-- Status Indicator -->
                <div
                  class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/50 ring-1"
                  :class="getStateStyle(c.state).ring"
                >
                  <div class="h-2 w-2 rounded-full" :class="getStateStyle(c.state).dot" />
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between mb-0.5">
                    <h3 class="font-bold text-sm text-foreground truncate pr-2 group-hover:text-primary transition-colors">
                      {{ c.name }}
                    </h3>
                    <div class="flex items-center gap-2">
                      <span class="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/60 bg-background/40 px-1.5 py-0.5 rounded">
                        {{ getStack(c) }}
                      </span>
                      <!-- FIX: Actions button diperbesar ke h-9 w-9 (≈ 36px) -->
                      <DropdownMenu>
                        <DropdownMenuTrigger as-child>
                          <Button variant="ghost" size="icon" class="h-9 w-9 rounded-full hover:bg-background/80">
                            <Icon name="i-lucide-more-vertical" class="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <!-- FIX: py-2.5 pada setiap item agar touch target cukup besar -->
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleViewLogs(c)">
                            <Icon name="i-lucide-file-text" class="mr-2 size-4" />
                            View Logs
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleAction(c.id, 'start')" :disabled="c.state === 'running'">
                            <Icon name="i-lucide-play" class="mr-2 size-4" />
                            Start
                          </DropdownMenuItem>
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleAction(c.id, 'stop')" :disabled="c.state !== 'running'">
                            <Icon name="i-lucide-square" class="mr-2 size-4" />
                            Stop
                          </DropdownMenuItem>
                          <DropdownMenuItem class="py-2.5 cursor-pointer" @click="handleAction(c.id, 'restart')">
                            <Icon name="i-lucide-rotate-cw" class="mr-2 size-4" />
                            Restart
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

              <!-- Stats Bar -->
              <div v-if="c.state === 'running'" class="grid grid-cols-2 gap-4 pt-1 border-t border-primary/5">
                <!-- CPU -->
                <div class="space-y-1.5">
                  <div class="flex justify-between text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/80">
                    <div class="flex items-center gap-1">
                      <span>CPU</span>
                      <span v-if="c.stats.limits?.cpu" class="text-[8px] font-normal opacity-70 normal-case bg-primary/5 px-1 rounded">
                        Max {{ c.stats.limits.cpu }}
                      </span>
                      <Icon v-else name="i-lucide-alert-triangle" class="size-3 text-amber-500/70" title="No CPU Limit Set" />
                    </div>
                    <span class="text-primary">{{ c.stats.cpu_percent }}%</span>
                  </div>
                  <div class="h-1.5 w-full bg-primary/10 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-primary transition-all duration-500 rounded-full"
                      :style="{ width: `${Math.min(c.stats.cpu_percent, 100)}%` }"
                    />
                  </div>
                </div>

                <!-- Memory -->
                <div class="space-y-1.5">
                  <div class="flex justify-between text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/80">
                    <div class="flex items-center gap-1">
                      <span>RAM</span>
                      <Icon v-if="!c.stats.limits?.memory" name="i-lucide-alert-triangle" class="size-3 text-amber-500/70" title="No Memory Limit Set" />
                    </div>
                    <span class="text-purple-400">{{ formatBytes(c.stats.mem_usage) }}</span>
                  </div>
                  <div class="h-1.5 w-full bg-purple-500/10 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-purple-500 transition-all duration-500 rounded-full"
                      :style="{ width: `${c.stats.mem_percent}%` }"
                    />
                  </div>
                  <div class="flex items-center justify-between text-[8px] text-muted-foreground/60 font-medium">
                    <span>Min: {{ c.stats.limits?.memory_reservation ? formatBytes(c.stats.limits.memory_reservation) : '-' }}</span>
                    <span :class="{'text-amber-500/80': !c.stats.limits?.memory}">
                      Max: {{ c.stats.limits?.memory ? formatBytes(c.stats.limits.memory) : 'Host (Unsafe)' }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Network -->
              <div v-if="c.state === 'running'" class="flex items-center justify-between text-[9px] text-muted-foreground/50 font-mono pt-1">
                <div class="flex items-center gap-1">
                  <Icon name="i-lucide-arrow-down" class="size-2.5" />
                  {{ formatBytes(c.stats.net_rx) }}
                </div>
                <div class="flex items-center gap-1">
                  <Icon name="i-lucide-arrow-up" class="size-2.5" />
                  {{ formatBytes(c.stats.net_tx) }}
                </div>
              </div>
            </div>

            <!-- Hover sidebar accent -->
            <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/50 transition-all duration-300" />
          </div>
        </TransitionGroup>
      </template>
    </CardContent>

    <DockerAuthModal v-model:open="authOpen" @authenticated="onAuthenticated" />
    <DockerLogsModal
      v-model:open="logsOpen"
      :container-id="selectedContainer?.id || null"
      :container-name="selectedContainer?.name"
    />
  </Card>
</template>
