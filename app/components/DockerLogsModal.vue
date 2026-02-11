<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { useIntervalFn } from '@vueuse/core'

const props = defineProps<{
  open: boolean
  containerId: string | null
  containerName?: string
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const isOpen = useVModel(props, 'open', emit)
const logs = ref('')
const loading = ref(false)
const autoScroll = ref(true)
const logContainerRef = ref<HTMLElement | null>(null)

// ANSI color converter (simple version)
function formatLogs(raw: string) {
  // Check for Docker headers (8 bytes at start of lines)
  // This is a naive cleanup, removing non-printable characters at the start of lines
  // A proper parser would read the stream header.
  return raw.replace(/[^\x20-\x7E\n\r\t]/g, '').trim()
}

async function fetchLogs() {
  if (!props.containerId) return
  
  try {
    const res = await $fetch<{ logs: string }>(`/api/docker/${props.containerId}/logs`, {
      query: { tail: 1000, timestamps: true }
    })
    logs.value = formatLogs(res.logs)
    
    if (autoScroll.value) {
      scrollToBottom()
    }
  } catch (e) {
    logs.value = `Error fetching logs: ${e}`
  }
}

function scrollToBottom() {
  nextTick(() => {
    if (logContainerRef.value) {
      logContainerRef.value.scrollTop = logContainerRef.value.scrollHeight
    }
  })
}

// Auto refresh logs when open
const { pause, resume } = useIntervalFn(() => {
    if (isOpen.value && props.containerId) {
        fetchLogs()
    }
}, 3000, { immediate: false })

watch(isOpen, (val) => {
    if (val) {
        logs.value = 'Loading logs...'
        fetchLogs()
        resume()
    } else {
        pause()
    }
})

function copyLogs() {
    navigator.clipboard.writeText(logs.value)
    // Could add toast here
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-4xl max-h-[85vh] h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#1e1e1e] text-white border-white/10 [&>button]:hidden">
      
      <!-- Header -->
      <DialogHeader class="px-4 py-3 border-b border-white/10 flex flex-row items-center justify-between space-y-0 bg-[#252526]">
        <div class="flex items-center gap-3">
           <div class="flex items-center gap-2">
              <Icon name="i-lucide-terminal" class="size-4 text-blue-400" />
              <DialogTitle class="font-mono text-sm font-normal text-gray-300">
                 logs/{{ containerName || props.containerId?.substring(0, 12) }}
              </DialogTitle>
           </div>
           <div class="h-4 w-px bg-white/10 mx-2"></div>
           <Badge variant="outline" class="text-[10px] font-mono border-white/20 text-green-400 bg-green-400/10">
              Live Tail
           </Badge>
        </div>
        
        <div class="flex items-center gap-2">
           <Button 
               variant="ghost" 
               size="sm" 
               class="h-7 text-xs text-gray-400 hover:text-white hover:bg-white/10"
               @click="autoScroll = !autoScroll"
            >
               <Icon :name="autoScroll ? 'i-lucide-arrow-down-circle' : 'i-lucide-pause-circle'" class="mr-2 size-3" />
               {{ autoScroll ? 'Auto-scroll On' : 'Paused' }}
           </Button>
           
           <Button 
               variant="ghost" 
               size="sm" 
               class="h-7 text-xs text-gray-400 hover:text-white hover:bg-white/10"
               @click="copyLogs"
            >
               <Icon name="i-lucide-copy" class="mr-2 size-3" />
               Copy
           </Button>
           
           <Button 
               variant="ghost" 
               size="icon" 
               class="h-7 w-7 text-gray-400 hover:text-white hover:bg-red-500/20 hover:text-red-400 ml-2"
               @click="isOpen = false"
            >
               <Icon name="i-lucide-x" class="size-4" />
           </Button>
        </div>
      </DialogHeader>
      
      <!-- Terminal Window -->
      <div 
         ref="logContainerRef"
         class="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent bg-[#1e1e1e]"
      >
         <pre class="whitespace-pre-wrap break-words font-mono text-gray-300">{{ logs }}</pre>
      </div>

    </DialogContent>
  </Dialog>
</template>
