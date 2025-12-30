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
      <MiniPlayer />

      <ServerMonitor />
    </main>
  </div>
</template>
