<script setup lang="ts">
import { useZenMode } from '~/composables/useZenMode'
const { isZenMode } = useZenMode()
</script>

<template>
  <SidebarProvider>
    <LayoutAppSidebar v-show="!isZenMode" />
    <SidebarInset :class="{ 'peer-data-[variant=inset]:min-h-svh': !isZenMode, '!m-0': isZenMode }">
      <div class="flex flex-col flex-1">
        <div class="@container/main p-4 lg:p-6 grow" :class="{ 'max-w-screen-2xl mx-auto w-full': isZenMode }">
          <!-- Floating Zen Mode Toggle (only visible in Zen Mode) -->
          <Transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 -translate-y-4"
            enter-to-class="opacity-100 translate-y-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 translate-y-0"
            leave-to-class="opacity-0 -translate-y-4"
          >
            <div v-if="isZenMode" class="fixed top-4 right-4 z-[50]">
              <ThemeCustomize />
            </div>
          </Transition>
          <slot />
        </div>
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>

<style scoped>

</style>
