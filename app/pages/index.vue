<script setup lang="ts">
import { useSidebar } from '~/components/ui/sidebar'

const dataCard = ref({
  uptime: 0,
  latency: 0,
  gateway: 0,
  concentrator: 0,
})

onMounted(() => {
  dataCard.value = {
    uptime: 198263,
    latency: 10,
    gateway: 45678,
    concentrator: 4,
  }
})

const { isMobile } = useSidebar()
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <main class="@container/main flex flex-1 flex-col gap-4 md:gap-8">
      <SidebarTrigger v-if="isMobile" />
      <div class="grid">
        <Card class="@container/card" />
      </div>
      <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-linear-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>UPTIME</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {{ dataCard.uptime }}
            </CardTitle>
          </CardHeader>
          <CardFooter class="flex-col items-start gap-1.5 text-sm">
            <div class="text-muted-foreground">
              Since last reboot
            </div>
          </CardFooter>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>LATENCY</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {{ dataCard.latency }}
            </CardTitle>
          </CardHeader>
          <CardFooter class="flex-col items-start gap-1.5 text-sm">
            <div class="text-muted-foreground">
              To Gateway
            </div>
          </CardFooter>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>GATEWAY IP</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {{ dataCard.gateway }}
            </CardTitle>
          </CardHeader>
          <CardFooter class="flex-col items-start gap-1.5 text-sm">
            <div class="text-muted-foreground">
              Remote Address
            </div>
          </CardFooter>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>CONCENTRATOR</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {{ dataCard.concentrator }}
            </CardTitle>
          </CardHeader>
          <CardFooter class="flex-col items-start gap-1.5 text-sm">
            <div class="text-muted-foreground">
              AC Selection
            </div>
          </CardFooter>
        </Card>
      </div>
    </main>
  </div>
</template>
