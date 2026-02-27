<script setup lang="ts">
import { computed } from 'vue'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
interface Props {
  open: boolean
  url: string
  containerName: string
  isSwarm?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['update:open'])

const isOpen = computed({
  get: () => props.open,
  set: (val) => emit('update:open', val)
})

const entityType = computed(() => props.isSwarm ? 'service Swarm' : 'container')

function confirmRedirect() {
  if (props.url) {
    window.open(props.url, '_blank')
    isOpen.value = false
  }
}
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle class="flex items-center gap-2 text-primary">
          <Icon name="i-lucide-external-link" class="size-5" />
          Kunjungi Website
        </AlertDialogTitle>
        <AlertDialogDescription class="space-y-4">
          <p>
            Kamu akan diarahkan ke website untuk {{ entityType }}
            <span class="font-bold text-foreground">{{ props.containerName }}</span> di tab baru.
          </p>
          <div class="p-3 bg-secondary/50 rounded-lg border border-primary/10 break-all font-mono text-xs text-primary">
            {{ props.url }}
          </div>
          <p class="text-[11px] text-muted-foreground/70 italic">
            * Pastikan domain sudah terkonfigurasi dengan benar di Traefik.
          </p>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Batal</AlertDialogCancel>
        <AlertDialogAction
          class="bg-primary hover:bg-primary/90 text-primary-foreground"
          @click="confirmRedirect"
        >
          <Icon name="i-lucide-external-link" class="mr-1.5 size-4" />
          Buka Website
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
