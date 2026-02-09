<script setup lang="ts">
const props = defineProps<{
    loading: boolean
}>()

const messages = [
  'Establishing secure connection...',
  'Loading system modules...',
  'Verifying integrity...',
  'Calibrating sensors...',
  'System ready.'
]

const currentMessage = ref(messages[0])

onMounted(() => {
  let i = 0
  const interval = setInterval(() => {
    i = (i + 1) % messages.length
    if (i < messages.length) {
       currentMessage.value = messages[i]
    }
  }, 300)

  onUnmounted(() => clearInterval(interval))
})
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-500 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-300 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div 
      v-if="loading"
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl"
    >
      <div class="relative flex flex-col items-center gap-4">
          <!-- Icon Container with Glow -->
          <div class="relative flex items-center justify-center size-24 rounded-full bg-linear-to-tr from-primary/10 via-primary/5 to-transparent border border-primary/20 shadow-2xl shadow-primary/10">
              <Icon name="lucide:server" class="size-10 text-primary animate-pulse" />
              <!-- Orbiting Dots -->
              <div class="absolute inset-0 size-full animate-[spin_3s_linear_infinite]">
                  <div class="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 size-2 rounded-full bg-primary/50 blur-[1px]"></div>
              </div>
              <div class="absolute inset-2 size-[calc(100%-16px)] animate-[spin_2s_linear_infinite_reverse]">
                  <div class="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 size-1.5 rounded-full bg-secondary blur-[0.5px]"></div>
              </div>
          </div>

          <!-- Text -->
          <div class="text-center space-y-1 mt-4">
              <h1 class="text-xl font-bold tracking-widest text-foreground">
                  DASHBOARD
              </h1>
              <p class="text-xs font-mono text-muted-foreground animate-pulse">
                  {{ currentMessage }}
              </p>
          </div>
      </div>
    </div>
  </Transition>
</template>
