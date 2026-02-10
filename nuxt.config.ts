import tailwindcss from '@tailwindcss/vite'

type MaybeProcessEnv = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> }
}

const env = ((globalThis as MaybeProcessEnv).process?.env) ?? {}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  devServer: {
    host: process.env.DEV_HOST || 'localhost',
    port: parseInt(process.env.DEV_PORT || '3000'),
  },

  runtimeConfig: {
    musicApi: {
      baseUrl: env.MUSIC_API_BASE || 'http://localhost:3000',
      placeholderUrl: env.MUSIC_API_PLACEHOLDER_URL || 'https://placehold.co/400?text=No+Cover&bg=1e293b&fg=ffffff',
    },
  },

  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [
      tailwindcss(),
    ],
  },

  components: [
    {
      path: '~/components',
      extensions: ['.vue'],
    },
  ],

  modules: [
    'shadcn-nuxt',
    '@vueuse/nuxt',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxt/fonts',
  ],

  shadcn: {
    /**
     * Prefix for all the imported component
     */
    prefix: '',
    /**
     * Directory that the component lives in.
     * @default "~/components/ui"
     */
    componentDir: '~/components/ui',
  },

  colorMode: {
    classSuffix: '',
  },

  eslint: {
    config: {
      standalone: false,
    },
  },

  fonts: {
    defaults: {
      weights: [300, 400, 500, 600, 700, 800],
    },
  },

  routeRules: {
    '/components': { redirect: '/components/accordion' },
    '/settings': { redirect: '/settings/profile' },
  },

  imports: {
    dirs: [
      './lib',
    ],
  },

  compatibilityDate: '2024-12-14',
})
