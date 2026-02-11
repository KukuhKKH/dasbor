<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { Toaster } from '@/components/ui/sonner'
import AppPreloader from '@/components/ui/AppPreloader.vue'
import 'vue-sonner/style.css'

const colorMode = useColorMode()
const color = computed(() => colorMode.value === 'dark' ? '#09090b' : '#ffffff')
const { theme } = useAppSettings()

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
  ],
  htmlAttrs: {
    lang: 'en',
  },
  bodyAttrs: {
    class: computed(() => `color-${theme.value?.color || 'default'} theme-${theme.value?.type || 'default'}`),
  },
})

const title = 'Dashboard Server'
const description = 'Dashboard Server'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  ogUrl: 'https://instagram.com/kukuhkkh',
})

const router = useRouter()

defineShortcuts({
  'G-H': () => router.push('/'),
})

const textDirection = useTextDirection({ initialValue: 'ltr' })
const dir = computed(() => textDirection.value === 'rtl' ? 'rtl' : 'ltr')

const loading = ref(true)

onMounted(() => {
  setTimeout(() => {
    loading.value = false
  }, 1500)
})
</script>

<template>
  <Body class="overscroll-none antialiased bg-background text-foreground">
    <ConfigProvider :dir="dir">
      
      <AppPreloader :loading="loading" />

      <div id="app" vaul-drawer-wrapper class="relative">
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>

        <AppSettings />
      </div>

      <Toaster :theme="colorMode.preference as any || 'system'" position="top-right" />
    </ConfigProvider>
  </Body>
</template>
