import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      include: [
        '@internationalized/date',
        '@number-flow/vue',
        '@tanstack/vue-table',
        '@unovis/ts',
        '@unovis/vue',
        '@vee-validate/zod',
        '@vueuse/core',
        '@vueuse/math',
        'class-variance-authority',
        'clsx',
        'date-fns',
        'embla-carousel',
        'embla-carousel-vue',
        'lucide-vue-next',
        'nanoid',
        'pinia',
        'reka-ui',
        'reka-ui/date',
        'tailwind-merge',
        'vaul-vue',
        'vee-validate',
        'vue-sonner',
        'vuedraggable',
        'zod',
      ],
    },
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
    providers: {
      fontshare: false,
    },
  },

  routeRules: {
    '/components': { redirect: '/components/accordion' },
    '/settings': { redirect: '/settings/profile' },
  },

  imports: {
    dirs: ['./lib'],
  },

  compatibilityDate: '2026-03-13',

  nitro: {
    experimental: {
      database: true,
    },
    database: {
      default: {
        connector: 'postgresql',
        options: {
          url: process.env.DATABASE_URL,
        },
      },
    },
    prerender: {
      ignore: [
        '/examples/forms',
        '/terms',
        '/privacy',
        '/components/pagination',
        '/docs',
      ],
    },
  },

  runtimeConfig: {
    gmailUser: '',
    gmailAppPassword: '',
    sessionPassword: '',
    vapidPrivateKey: '',
    vapidSubject: '',
    siteUrl: 'http://localhost:3000',
    public: {
      vapidPublicKey: '',
    },
  },
})
