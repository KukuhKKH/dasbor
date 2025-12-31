<script setup lang="ts">
import type { NavGroup, NavLink, NavSectionTitle } from '~/types/nav'
import { navMenu, navMenuBottom } from '~/constants/menus'

function resolveNavItemComponent(item: NavLink | NavGroup | NavSectionTitle): any {
  if ('children' in item)
    return resolveComponent('LayoutSidebarNavGroup')

  return resolveComponent('LayoutSidebarNavLink')
}
const { sidebar } = useAppSettings()
const showTerminal = ref(false)
</script>

<template>
  <Sidebar :collapsible="sidebar?.collapsible" :side="sidebar?.side" :variant="sidebar?.variant">
    <SidebarContent class="flex flex-col items-center px-4 py-8 gap-6 overflow-hidden">
      <!-- Avatar with premium styling -->
      <div class="relative group">
        <div class="absolute -inset-1 bg-linear-to-r from-primary to-blue-600 rounded-full blur-md opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
        <Avatar class="size-24 border-2 border-background relative ring-4 ring-primary/10 transition-transform duration-500 hover:scale-105">
          <AvatarImage src="/img/logo.png" alt="BangLipai Cloud" class="object-cover" />
          <AvatarFallback class="bg-primary/5 text-primary text-xl font-bold">
            BC
          </AvatarFallback>
        </Avatar>
      </div>

      <!-- Branding Text -->
      <div class="flex flex-col items-center text-center gap-2">
        <h2 class="text-xl font-bold tracking-tight bg-linear-to-br from-foreground to-foreground/70 bg-clip-text text-primary">
          BangLipai Cloud
        </h2>
        <p class="text-[13px] text-muted-foreground leading-relaxed max-w-[200px]">
          Connecting the Indonesian Community via high-performance infrastructure.
        </p>
      </div>

      <!-- Social Media Buttons -->
      <div class="flex items-center gap-3">
        <Button variant="outline" size="icon" class="rounded-full hover:bg-primary hover:text-primary-foreground transition-all duration-300" as-child>
          <a href="https://github.com/kukuhkkh" target="_blank" aria-label="Github">
            <Icon name="i-lucide-github" class="size-4" />
          </a>
        </Button>
        <Button variant="outline" size="icon" class="rounded-full hover:bg-[#5865F2] hover:text-white transition-all duration-300" as-child>
          <a href="https://discord.com/users/550650227955204099" target="_blank" aria-label="Discord">
            <Icon name="i-simple-icons-discord" class="size-4" />
          </a>
        </Button>
        <Button variant="outline" size="icon" class="rounded-full hover:bg-linear-to-br hover:from-[#833AB4] hover:via-[#FD1D1D] hover:to-[#FCB045] hover:text-white transition-all duration-300 border-none bg-accent/50" as-child>
          <a href="https://instagram.com/kukuhkkh" target="_blank" aria-label="Instagram">
            <Icon name="i-lucide-instagram" class="size-4" />
          </a>
        </Button>
      </div>

      <!-- Navigation Links -->
      <div class="flex flex-col w-full gap-2 mt-2">
        <Button variant="ghost" class="w-full justify-start gap-3 px-4 py-6 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary group/nav" @click="showTerminal = true">
          <div class="cursor-pointer flex items-center gap-3 w-full">
            <div class="p-2 rounded-lg bg-primary/5 group-hover/nav:bg-primary/20 transition-colors">
              <Icon name="i-lucide-terminal" class="size-4" />
            </div>
            System Terminal
          </div>
        </Button>
        <Button variant="ghost" class="w-full justify-start gap-3 px-4 py-6 text-sm font-medium transition-all duration-200 hover:bg-primary/10 hover:text-primary group/nav" as-child>
          <div class="cursor-pointer">
            <div class="p-2 rounded-lg bg-primary/5 group-hover/nav:bg-primary/20 transition-colors">
              <Icon name="i-lucide-network" class="size-4" />
            </div>
            Network Topology
          </div>
        </Button>
      </div>
    </SidebarContent>
    <SidebarRail />
  </Sidebar>

  <TerminalModal v-model:open="showTerminal" />
</template>

<style scoped>

</style>
