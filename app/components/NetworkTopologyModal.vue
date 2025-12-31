<script setup lang="ts">
import { useVModel } from '@vueuse/core'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const isOpen = useVModel(props, 'open', emit)

const zones = [
  { label: 'Public Zone (Internet Facing)', x: 80, y: 60, w: 260, h: 480, color: 'rgba(239, 68, 68, 0.05)', border: 'rgba(239, 68, 68, 0.2)' },
  { label: 'Private Zone (Application Layer)', x: 360, y: 60, w: 420, h: 480, color: 'rgba(59, 130, 246, 0.05)', border: 'rgba(59, 130, 246, 0.2)' },
  { label: 'Data Zone (Restricted Access)', x: 800, y: 60, w: 240, h: 480, color: 'rgba(16, 185, 129, 0.05)', border: 'rgba(16, 185, 129, 0.2)' }
]

const nodes = [
   // Public Zone
   { id: 'origin', label: 'Origin Cloud', specs: 'SG-1 • 8 vCPU', icon: 'i-lucide-globe', x: 210, y: 150, color: '#3b82f6' },
   { id: 'security', label: 'Security Layer', specs: 'WAF • DDoS Prot', icon: 'i-lucide-shield-alert', x: 210, y: 280, color: '#ef4444' },
   { id: 'nat', label: 'NAT Gateway', specs: 'ID-JKT • 1 Gbps', icon: 'i-lucide-router', x: 210, y: 410, color: '#10b981' },

   // Private Zone
   { id: 'traefik', label: 'Traefik LB', specs: 'Ingress • v3.0', icon: 'i-lucide-container', x: 460, y: 280, color: '#f59e0b' },
   { id: 'master', label: 'Swarm Master', specs: 'Cluster Mgmt', icon: 'i-lucide-cpu', x: 640, y: 150, color: '#6366f1' },
   { id: 'worker1', label: 'App Worker 01', specs: 'High Memory', icon: 'i-lucide-server', x: 640, y: 280, color: '#8b5cf6' },
   { id: 'worker2', label: 'App Worker 02', specs: 'General Purpose', icon: 'i-lucide-server', x: 640, y: 410, color: '#d946ef' },
   { id: 'obs', label: 'Observability', specs: 'Grafana • Prom', icon: 'i-lucide-activity', x: 460, y: 450, color: '#ec4899' },

   // Data Zone
   { id: 'db', label: 'Persistence', specs: 'PostgreSQL HA', icon: 'i-lucide-database', x: 920, y: 200, color: '#06b6d4' },
   { id: 'storage', label: 'Object Storage', specs: 'MinIO Cluster', icon: 'i-lucide-hard-drive', x: 920, y: 360, color: '#14b8a6' },
]

const connections = [
   // Public Flow
   { from: 'origin', to: 'security' },
   { from: 'security', to: 'nat' },
   { from: 'nat', to: 'traefik' },
   
   // Private Flow
   { from: 'traefik', to: 'master' },
   { from: 'traefik', to: 'worker1' },
   { from: 'traefik', to: 'worker2' },
   
   // Cluster Management
   { from: 'master', to: 'worker1' },
   { from: 'master', to: 'worker2' },
   
   // Data Flow
   { from: 'worker1', to: 'db' },
   { from: 'worker2', to: 'db' },
   { from: 'worker1', to: 'storage' },
   { from: 'worker2', to: 'storage' },

   // Observability
   { from: 'obs', to: 'traefik' },
   { from: 'obs', to: 'master' }
]

function getNode(id: string) {
   return nodes.find(n => n.id === id)!
}

function getPath(conn: { from: string, to: string }) {
   const start = getNode(conn.from)
   const end = getNode(conn.to)
   
   // Curving logic
   const midX = (start.x + end.x) / 2
   return `M ${start.x} ${start.y} C ${midX} ${start.y}, ${midX} ${end.y}, ${end.x} ${end.y}`
}
</script>

<template>
  <Transition
     enter-active-class="transition duration-300 ease-out"
     enter-from-class="opacity-0 active:scale-95"
     enter-to-class="opacity-100 scale-100"
     leave-active-class="transition duration-200 ease-in"
     leave-from-class="opacity-100 scale-100"
     leave-to-class="opacity-0 scale-95"
  >
    <div v-if="isOpen" class="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div class="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity" @click="isOpen = false" />

      <div class="relative w-full max-w-6xl h-[700px] flex flex-col rounded-2xl overflow-hidden shadow-2xl bg-[#09090b] border border-white/10 ring-1 ring-white/5">
        <div class="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/5">
           <div class="flex flex-col">
              <h3 class="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                 <Icon name="i-lucide-network" class="size-5 text-primary" />
                 Swarm Cluster Topology
              </h3>
              <p class="text-xs text-muted-foreground">Multi-zone infrastructure visualization</p>
           </div>
           <button @click="isOpen = false" class="text-gray-400 hover:text-white transition-colors">
              <Icon name="i-lucide-x" class="size-6" />
           </button>
        </div>

        <div class="flex-1 relative overflow-hidden bg-[radial-gradient(ellipse_at_center,var(--tw-gradient-stops))] from-slate-900 to-black">
           <div class="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px]"></div>
           <div class="absolute inset-0 pointer-events-none">
               <div 
                  v-for="(zone, i) in zones" 
                  :key="'zone-'+i"
                  class="absolute rounded-xl border border-dashed flex flex-col items-center pt-4"
                  :style="{ 
                     left: `${zone.x}px`, 
                     top: `${zone.y}px`, 
                     width: `${zone.w}px`, 
                     height: `${zone.h}px`,
                     backgroundColor: zone.color,
                     borderColor: zone.border
                  }"
               >
                  <span class="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-black/40 text-white/80 border border-white/5 backdrop-blur-sm">
                     {{ zone.label }}
                  </span>
               </div>
            </div>

           <svg class="absolute inset-0 w-full h-full pointer-events-none">
              <defs>
                 <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                 </filter>
                 <linearGradient id="fiber-gradient" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0" />
                    <stop offset="50%" stop-color="#ffffff" stop-opacity="1" />
                    <stop offset="100%" stop-color="#3b82f6" stop-opacity="0" />
                 </linearGradient>
              </defs>

              <!-- Connection Lines (Dimmed base) -->
              <g>
                 <path 
                    v-for="(conn, i) in connections" 
                    :key="'bg-'+i"
                    :d="getPath(conn)"
                    fill="none"
                    stroke="#ffffff"
                    stroke-opacity="0.1"
                    stroke-width="1.5"
                 />
              </g>

              <!-- Animated Data Packets (Fiber Optic Effect) -->
              <g>
                 <path 
                    v-for="(conn, i) in connections" 
                    :key="'flow-'+i"
                    :d="getPath(conn)"
                    fill="none"
                    stroke="url(#fiber-gradient)"
                    stroke-width="2"
                    class="animate-flow"
                    :style="{ animationDelay: `${i * 0.1}s`, animationDuration: `${1.5 + (i%2)}s` }"
                 />
              </g>
           </svg>

           <!-- Nodes (HTML Overlay for ease of styling) -->
           <div class="absolute inset-0">
              <div 
                 v-for="node in nodes" 
                 :key="node.id"
                 class="absolute -translate-x-1/2 flex flex-col items-center gap-3 group cursor-pointer"
                 :style="{ left: `${node.x}px`, top: `${node.y - 32}px` }"
              >
                 <!-- Icon Circle -->
                 <div 
                    class="relative flex items-center justify-center size-14 rounded-full bg-[#18181b] border border-white/10 shadow-xl transition-all duration-300 group-hover:scale-110 group-hover:border-primary/50 z-10"
                    :style="{ boxShadow: `0 0 20px ${node.color}20` }"
                 >
                    <Icon :name="node.icon" class="size-6 text-white" />
                    
                    <!-- Ripple Effect -->
                    <div class="absolute inset-0 rounded-full animate-ping opacity-20" :style="{ backgroundColor: node.color }"></div>
                 </div>

                 <!-- Label -->
                 <div class="flex flex-col items-center z-20">
                    <span class="text-xs font-bold text-white bg-black/60 px-2.5 py-1 rounded-md backdrop-blur-md border border-white/10 whitespace-nowrap shadow-lg">{{ node.label }}</span>
                    <span class="text-[10px] text-muted-foreground font-mono mt-1 whitespace-nowrap opacity-80 group-hover:opacity-100 transition-opacity bg-black/40 px-1.5 rounded">{{ node.specs }}</span>
                 </div>
              </div>
           </div>
           
           <!-- Legend / Stats -->
           <div class="absolute bottom-6 left-6 flex flex-col gap-2 p-4 rounded-xl bg-black/60 border border-white/10 backdrop-blur-md">
              <div class="flex items-center gap-2">
                 <div class="size-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 <span class="text-xs font-mono text-white">Network Status: Optimal</span>
              </div>
              <div class="flex items-center gap-2">
                 <Icon name="i-lucide-activity" class="size-3 text-primary" />
                 <span class="text-xs font-mono text-muted-foreground">Throughput: 1.2 GB/s</span>
              </div>
           </div>

        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.animate-flow {
   stroke-dasharray: 10 100;
   stroke-dashoffset: 200;
   animation: dash 2s linear infinite;
}

@keyframes dash {
   from {
      stroke-dashoffset: 200;
   }
   to {
      stroke-dashoffset: 0;
   }
}
</style>
