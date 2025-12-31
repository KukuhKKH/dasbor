<script setup lang="ts">
import { useSidebar } from "~/components/ui/sidebar";

useHead({ title: "VM Dashboard" });

const { isMobile } = useSidebar();
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <main class="@container/main flex flex-1 flex-col gap-4">
      <div v-if="isMobile" class="flex items-center">
        <SidebarTrigger />
      </div>
      <DasboardMiniPlayer />

      <DasboardServerMonitor />
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DasboardDockerHealth />
        <DasboardSystemResource />
      </div>
    </main>
  </div>
</template>
