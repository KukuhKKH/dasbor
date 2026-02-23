<script setup lang="ts">

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
}>()

const isOpen = useVModel(props, 'open', emit)

const inputRef = ref<HTMLInputElement | null>(null)
const terminalBodyRef = ref<HTMLElement | null>(null)
const currentInput = ref('')
const history = ref<{ type: 'input' | 'output'; content: string }[]>([])
const isTyping = ref(false)

const commands: Record<string, (args: string[]) => string | void> = {
  help: () => `Available commands:
  help    - Show this help message
  ls      - List files in current directory
  clear   - Clear terminal screen
  whoami  - Print current user
  uname   - Print system information
  exit    - Close terminal session`,
  ls: () => `drwxr-xr-x  2 root root  4096 Jan 01 10:00 .
drwxr-xr-x  2 root root  4096 Jan 01 10:00 ..
-rw-r--r--  1 root root  1234 Jan 01 10:00 deploy.sh
-rw-r--r--  1 root root   567 Jan 01 10:00 docker-compose.yml
drwxr-xr-x  2 root root  4096 Jan 01 10:00 logs`,
  clear: () => {
    history.value = []
    return ''
  },
  whoami: () => 'root',
  uname: () => 'Linux vm-dashboard 5.15.0-101-generic #113-Ubuntu SMP Thu Jan 25 15:00:00 UTC 2024 x86_64 x86_64 x86_64 GNU/Linux',
  exit: () => {
     isOpen.value = false
     return 'Session closed.'
  }
}

// Initial Greeting
const welcomeLines = [
  'Welcome to Ubuntu 22.04.3 LTS (GNU/Linux 5.15.0-101-generic x86_64)',
  '',
  ' * Documentation:  https://help.ubuntu.com',
  ' * Management:     https://landscape.canonical.com',
  ' * Support:        https://ubuntu.com/advantage',
  '',
  'System information as of ' + new Date().toUTCString(),
  '',
  '  System load:  0.08              Processes:             102',
  '  Usage of /:   15.2% of 30.0GB   Users logged in:       1',
  '  Memory usage: 24%               IPv4 address for eth0: 192.168.1.10',
  '  Swap usage:   0%                IPv4 address for docker0: 172.17.0.1',
  '',
  'Last login: ' + new Date().toUTCString() + ' from 192.168.1.1',
]

async function startSession() {
   history.value = [] // Reset
   isTyping.value = true
   
   for (const line of welcomeLines) {
      if (!isOpen.value) {
         isTyping.value = false;
         return; 
      }

      history.value.push({ type: 'output', content: line })
      await new Promise(r => setTimeout(r, 40)) // slight delay between lines
   }
   
   isTyping.value = false
   nextTick(() => { focusInput() })
}


watch(isOpen, (val: boolean) => {
  if (val) {
    startSession()
  } else {
    history.value = []
    currentInput.value = ''
  }
})

function handleEnter() {
  const cmd = currentInput.value.trim()
  history.value.push({ type: 'input', content: `root@vm-dashboard:~# ${cmd}` })
  
  if (cmd) {
    const parts = cmd.split(' ')
    const commandName = parts[0] || ''
    const args = parts.slice(1)
    
    const command = commands[commandName.toLowerCase()]
    
    if (command) {
      const output = command(args)
      if (typeof output === 'string' && output !== '') {
          history.value.push({ type: 'output', content: output })
      }
    } else {
      history.value.push({ type: 'output', content: `bash: ${commandName}: command not found` })
    }
  }
  
  currentInput.value = ''
  scrollToBottom()
}

function scrollToBottom() {
  nextTick(() => {
    if (terminalBodyRef.value) {
      terminalBodyRef.value.scrollTop = terminalBodyRef.value.scrollHeight
    }
  })
}

function focusInput() {
  inputRef.value?.focus()
}

// Keep focus
function handleContainerClick() {
   if (!window.getSelection()?.toString()) {
      focusInput()
   }
}
</script>

<template>
  <Transition
     enter-active-class="transition duration-200 ease-out"
     enter-from-class="opacity-0 scale-95"
     enter-to-class="opacity-100 scale-100"
     leave-active-class="transition duration-150 ease-in"
     leave-from-class="opacity-100 scale-100"
     leave-to-class="opacity-0 scale-95"
  >
    <div v-if="isOpen" class="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <!-- Backdrop -->
      <div class="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="isOpen = false" />

      <!-- Terminal Window -->
      <div 
        class="relative w-full max-w-4xl h-[600px] flex flex-col rounded-xl overflow-hidden shadow-2xl bg-[#1e1e1e] ring-1 ring-white/10"
        @click="handleContainerClick"
      >
        <!-- Title Bar -->
        <div class="flex items-center justify-between px-4 py-3 bg-[#252526] border-b border-white/5 select-none text-white">
           <div class="flex items-center gap-2">
              <button @click="isOpen = false" class="size-3 rounded-full bg-[#ff5f56] hover:bg-[#ff5f56]/80 transition-colors shadow-inner"></button>
              <button class="size-3 rounded-full bg-[#ffbd2e] hover:bg-[#ffbd2e]/80 transition-colors shadow-inner"></button>
              <button class="size-3 rounded-full bg-[#27c93f] hover:bg-[#27c93f]/80 transition-colors shadow-inner"></button>
           </div>
           <div class="text-xs font-medium text-gray-400 font-mono flex items-center gap-2 opacity-80">
              <Icon name="i-lucide-monitor" class="size-3" />
              root@vm-dashboard:~
           </div>
           <div class="w-14"></div> <!-- Spacer for center alignment -->
        </div>

        <!-- Terminal Content -->
        <div 
           ref="terminalBodyRef"
           class="flex-1 p-4 overflow-y-auto font-mono text-sm leading-relaxed scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10"
           @click="focusInput"
        >
           <div v-for="(line, idx) in history" :key="idx" class="break-words whitespace-pre-wrap mb-1" :class="line.type === 'input' ? 'text-white' : 'text-gray-300'">
              {{ line.content }}
           </div>

           <!-- Helper Input Line for typing -->
           <div class="flex items-center text-white" v-if="!isTyping">
              <span class="text-green-400 font-bold mr-2 whitespace-nowrap">root@vm-dashboard:~#</span>
              <span class="whitespace-pre-wrap">{{ currentInput }}</span>
              <span class="w-2.5 h-5 bg-gray-400 ml-1 animate-pulse inline-block align-middle cursor-block"></span>
           </div>
        </div>
        
        <!-- Hidden Input -->
        <input 
           ref="inputRef"
           v-model="currentInput"
           type="text" 
           class="absolute opacity-0 top-0 left-0 h-0 w-0 -z-10" 
           @keydown.enter="handleEnter"
           autocomplete="off"
           spellcheck="false"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.cursor-block {
   animation: pulse 1s infinite;
}
@keyframes pulse {
   0%, 100% { opacity: 1; }
   50% { opacity: 0; }
}
</style>
