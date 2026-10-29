import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'

const isDev = process.env.NODE_ENV !== 'production'
// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: true },

  css: ['~/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
    // zod/@vee-validate/zod are only reachable through lazily-imported page chunks (form
    // pages), and Nitro's file-tracer for the Vercel/node-server output doesn't reliably pick
    // up dependencies behind that kind of dynamic import boundary — it copies a different,
    // internal zod (a Nitro tooling dependency) into .output but not this one, so requests to
    // those pages 500 with ERR_MODULE_NOT_FOUND in production despite zod being a real
    // dependency. Forcing these to bundle inline (not stay an external runtime import) sidesteps
    // the trace entirely.
    ssr: {
      noExternal: ['zod', '@vee-validate/zod'],
    },
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
    '@scalar/nuxt',
  ],

  // API reference (Scalar). /docs is the public reference for the external APIs — a hand-written
  // spec in server/utils/publicApiSpec.ts served at /openapi.json. In development only, /docs/internal
  // also lists every server route from Nitro's auto-generated /_openapi.json.
  scalar: {
    darkMode: true,
    configurations: [
      {
        url: '/openapi.json',
        pathRouting: { basePath: '/docs' },
        metaData: { title: 'Canopy API Reference' },
      },
      ...(isDev
        ? [{
            url: '/_openapi.json',
            pathRouting: { basePath: '/docs/internal' },
            metaData: { title: 'Internal Routes (dev only)' },
          }]
        : []),
    ],
  },

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
      weights: [400, 500, 600, 700, 800, 900],
    },
    providers: {
      fontshare: false,
    },
  },

  routeRules: {
    '/settings': { redirect: '/settings/profile' },
    // The old staff-console overview is now the Canopy HQ home.
    '/console': { redirect: '/hq' },
    // Customer Service has no landing page of its own; the breadcrumb goes to the live monitor.
    '/service': { redirect: '/service/monitor' },
  },

  imports: {
    dirs: ['./lib'],
  },

  compatibilityDate: '2026-03-13',

  nitro: {
    hooks: {
      // Typed $fetch infers response types by matching the URL against every API route; past a
      // couple of hundred routes TypeScript gives up ("type instantiation is excessively deep").
      // Routes only ever called from outside the app — schedulers, OAuth redirects, Slack — don't
      // need typing, so they're left out of the generated route types.
      'types:extend': (types) => {
        // Called through fetchUntyped (app/lib), so they don't need typed $fetch routes — keeping the
        // route union small avoids "Type instantiation is excessively deep".
        const untyped = ['/api/cron/', '/api/integrations/', '/api/slack/', '/api/service/', '/api/ai-agents/', '/api/care/', '/api/hq/']
        for (const path of Object.keys(types.routes)) {
          if (untyped.some(prefix => path.startsWith(prefix)))
            delete types.routes[path]
        }
      },
    },
    experimental: {
      database: true,
      // Lets any server code find the current request (useEvent) — used to pick the signed-in
      // company's database (server/utils/tenancy.ts).
      asyncContext: true,
      // Auto-generated route list for /docs/internal — development only. It must be off (not just
      // `openAPI.production: false`) in builds: @scalar/nuxt sets `openAPI.production ||= 'prerender'`,
      // which overwrites `false` and would publish every internal route as /_openapi.json.
      openAPI: isDev,
    },
    openAPI: {
      production: false,
      meta: { title: 'Canopy internal routes', version: 'dev' },
      ui: { scalar: false, swagger: false },
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
        '/docs',
      ],
    },
  },

  runtimeConfig: {
    gmailClientId: '',
    gmailClientSecret: '',
    gmailRefreshToken: '',
    gmailSender: '',
    gmailFromName: 'Canopy',
    cronSecret: '',
    sessionPassword: '',
    vapidPrivateKey: '',
    vapidSubject: '',
    siteUrl: 'http://localhost:3000',
    integrationsEncryptionKey: '',
    slackClientId: '',
    slackClientSecret: '',
    anthropicApiKey: '',
    // Models used for each person's own AI provider in "Ask AI" — override with
    // NUXT_AI_GEMINI_MODEL / NUXT_AI_OPENAI_MODEL / NUXT_AI_ANTHROPIC_MODEL as providers ship new ones.
    aiGeminiModel: 'gemini-2.5-flash',
    aiOpenaiModel: 'gpt-4.1-mini',
    aiAnthropicModel: 'claude-haiku-4-5-20251001',
    public: {
      vapidPublicKey: '',
      portalCorsOrigins: '',
    },
  },
})
