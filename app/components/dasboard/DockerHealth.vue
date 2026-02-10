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
  };
}

const { data: containers, refresh } = await useFetch<Container[]>(
  "/api/docker/containers",
  {
    key: "docker-list",
    default: () => [],
  },
);

// Auto refresh tiap 1 menit untuk stats live
useIntervalFn(() => {
  refresh();
}, 60000);

const activeCount = computed(() => {
  return containers.value?.filter((c) => c.state === "running").length || 0;
});

function getStateColor(state: string) {
  switch (state) {
    case "running":
      return "bg-emerald-500";
    case "exited":
      return "bg-slate-500";
    case "restarting":
      return "bg-amber-500";
    default:
      return "bg-red-500";
  }
}

function getStateRingColor(state: string) {
  switch (state) {
    case "running":
      return "ring-emerald-500/30";
    case "exited":
      return "ring-slate-500/30";
    case "restarting":
      return "ring-amber-500/30";
    default:
      return "ring-red-500/30";
  }
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
const pendingAction = ref<{ id: string, action: string } | null>(null)
const isAuthenticated = useCookie('docker_is_authenticated')

function handleAction(id: string, action: string) {
  if (isAuthenticated.value) {
    executeAction(id, action)
  } else {
    pendingAction.value = { id, action }
    authOpen.value = true
  }
}

function onAuthenticated() {
  if (pendingAction.value) {
    executeAction(pendingAction.value.id, pendingAction.value.action)
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
    <CardHeader class="flex flex-row items-center justify-between pb-4">
      <div class="space-y-1">
        <CardTitle class="text-xl font-bold tracking-tight">
          Docker Health
        </CardTitle>
        <CardDescription class="text-sm text-muted-foreground">
          Container status & live metrics
        </CardDescription>
      </div>
      <div class="flex items-center gap-2">
         <div
           class="flex items-center gap-2 bg-secondary/50 px-3 py-1 rounded-full border border-primary/5"
         >
           <span
             class="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
           />
           <span class="text-xs font-semibold text-foreground">
             {{ activeCount }} Active
           </span>
         </div>
         <Button variant="outline" size="icon" class="h-8 w-8 rounded-full" @click="refresh()">
             <Icon name="i-lucide-refresh-cw" class="size-4" />
         </Button>
      </div>
    </CardHeader>

    <CardContent
      class="flex-1 overflow-y-auto min-h-[350px] pr-2 space-y-3 scrollbar-thin scrollbar-track-secondary/20 scrollbar-thumb-primary/20"
    >
      <div
        v-if="!containers || containers.length === 0"
        class="flex flex-col items-center justify-center py-20 text-center space-y-3"
      >
        <div class="p-4 rounded-full bg-secondary/50">
          <Icon
            name="i-lucide-container"
            class="size-8 text-muted-foreground/50"
          />
        </div>
        <div class="space-y-1">
          <div class="text-sm font-medium text-muted-foreground">
            No Containers Found
          </div>
          <p class="text-xs text-muted-foreground/60 max-w-[200px]">
            Docker might be offline or socket is not accessible.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          class="rounded-full"
          @click="refresh()"
        >
          Retry Connection
        </Button>
      </div>

      <template v-else>
        <div
          v-for="c in containers"
          :key="c.id"
          class="group relative overflow-hidden rounded-xl border border-primary/5 bg-secondary/10 hover:bg-secondary/30 transition-all duration-300"
        >
          <div class="flex flex-col p-3 gap-3">
            <!-- Top info -->
            <div class="flex items-center gap-3">
              <!-- Status Indicator -->
              <div
                class="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/50 ring-1"
                :class="getStateRingColor(c.state)"
              >
                <div
                  class="h-2 w-2 rounded-full"
                  :class="getStateColor(c.state)"
                />
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between mb-0.5">
                  <h3
                    class="font-bold text-sm text-foreground truncate pr-2 group-hover:text-primary transition-colors"
                  >
                    {{ c.name }}
                  </h3>
                  
                  <div class="flex items-center gap-2">
                     <span
                       class="text-[9px] uppercase font-bold tracking-wider text-muted-foreground/60 bg-background/40 px-1.5 py-0.5 rounded"
                     >
                       {{ getStack(c) }}
                     </span>
                     
                     <!-- Actions Menu -->
                     <DropdownMenu>
                       <DropdownMenuTrigger as-child>
                         <Button variant="ghost" size="icon" class="h-6 w-6 rounded-full hover:bg-background/80">
                           <Icon name="i-lucide-more-vertical" class="size-3.5" />
                         </Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent align="end">
                         <DropdownMenuLabel>Actions</DropdownMenuLabel>
                         <DropdownMenuSeparator />
                         <DropdownMenuItem @click="handleAction(c.id, 'start')" :disabled="c.state === 'running'">
                           <Icon name="i-lucide-play" class="mr-2 size-3.5" />
                           Start
                         </DropdownMenuItem>
                         <DropdownMenuItem @click="handleAction(c.id, 'stop')" :disabled="c.state !== 'running'">
                           <Icon name="i-lucide-square" class="mr-2 size-3.5" />
                           Stop
                         </DropdownMenuItem>
                         <DropdownMenuItem @click="handleAction(c.id, 'restart')">
                           <Icon name="i-lucide-rotate-cw" class="mr-2 size-3.5" />
                           Restart
                         </DropdownMenuItem>
                       </DropdownMenuContent>
                     </DropdownMenu>
                  </div>
                </div>
                <div
                  class="text-[10px] text-muted-foreground flex items-center justify-between"
                >
                  <span class="truncate opacity-70">{{ c.image }}</span>
                  <span class="italic font-medium">{{ c.status }}</span>
                </div>
              </div>
            </div>

            <!-- Stats Bar (Only if running) -->
            <div
              v-if="c.state === 'running'"
              class="grid grid-cols-2 gap-4 pt-1 border-t border-primary/5"
            >
              <div class="space-y-1.5">
                <div
                  class="flex justify-between text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/80"
                >
                  <span>CPU</span>
                  <span class="text-primary">{{ c.stats.cpu_percent }}%</span>
                </div>
                <div
                  class="h-1 w-full bg-primary/10 rounded-full overflow-hidden"
                >
                  <div
                    class="h-full bg-primary transition-all duration-500"
                    :style="{ width: `${Math.min(c.stats.cpu_percent, 100)}%` }"
                  />
                </div>
              </div>
              <div class="space-y-1.5">
                <div
                  class="flex justify-between text-[10px] uppercase tracking-tighter font-bold text-muted-foreground/80"
                >
                  <span>RAM</span>
                  <span class="text-purple-400">{{
                    formatBytes(c.stats.mem_usage)
                  }}</span>
                </div>
                <div
                  class="h-1 w-full bg-purple-500/10 rounded-full overflow-hidden"
                >
                  <div
                    class="h-full bg-purple-500 transition-all duration-500"
                    :style="{ width: `${c.stats.mem_percent}%` }"
                  />
                </div>
              </div>
            </div>

            <!-- Network Minimal Stats -->
            <div
              v-if="c.state === 'running'"
              class="flex items-center justify-between text-[9px] text-muted-foreground/50 font-mono"
            >
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
          <div
            class="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/0 group-hover:bg-primary/50 transition-all duration-300"
          />
        </div>
      </template>
    </CardContent>
    
    <DockerAuthModal v-model:open="authOpen" @authenticated="onAuthenticated" />
  </Card>
</template>
