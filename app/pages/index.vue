<script setup lang="ts">
import { useSidebar } from "~/components/ui/sidebar";

useHead({ title: "VM Dashboard" });

const { isMobile } = useSidebar();
</script>

<template>
  <main class="@container/main w-full flex flex-1 flex-col gap-4">
    <div v-if="isMobile" class="flex items-center">
      <SidebarTrigger />
    </div>
    <DasboardMiniPlayer />

    <DasboardServerMonitor />
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[500px] lg:max-h-[calc(100vh-6rem)]">
      <DasboardDockerHealth />
      <DasboardSystemResource />
    </div>
  </main>
</template>
