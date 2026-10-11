<script setup lang="ts">
import { ConfigProvider } from 'reka-ui'
import { Toaster } from '@/components/ui/sonner'
import 'vue-sonner/style.css'

const colorMode = useColorMode()
// The forest top bar in both modes, so the browser chrome blends into it.
const color = computed(() => '#163300')
const { theme } = useAppSettings()

useHead({
  meta: [
    { charset: 'utf-8' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { key: 'theme-color', name: 'theme-color', content: color },
  ],
  link: [
    { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
    { rel: 'icon', href: '/favicon.ico', sizes: '64x64' },
    { rel: 'manifest', href: '/manifest.webmanifest' },
    { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
  ],
  htmlAttrs: {
    lang: 'en',
  },
  bodyAttrs: {
    class: computed(() => `color-${theme.value?.color || 'default'} theme-${theme.value?.type || 'default'}`),
  },
})

const title = 'Canopy'
const description = 'Every customer. Every team. One canopy. Support, sales, projects and reporting on one record.'

useSeoMeta({
  title,
  description,
  ogTitle: title,
  ogDescription: description,
  // ogUrl: 'https://dashboard.dianprata.com',
  // ogImage: 'https://nuxt-shadcn-dashboard.vercel.app/social-card.png',
  // twitterTitle: title,
  // twitterDescription: description,
  // twitterImage: 'https://nuxt-shadcn-dashboard.vercel.app/social-card.png',
  // twitterCard: 'summary_large_image',
})

const router = useRouter()

defineShortcuts({
  'G-H': () => router.push('/'),
  'G-T': () => router.push('/tickets'),
})

const textDirection = useTextDirection({ initialValue: 'ltr' })
const dir = computed(() => textDirection.value === 'rtl' ? 'rtl' : 'ltr')
</script>

<template>
  <Body class="overscroll-none antialiased bg-background text-foreground">
    <ConfigProvider :dir="dir">
      <div id="app" vaul-drawer-wrapper class="relative">
        <NuxtLayout>
          <NuxtPage />
        </NuxtLayout>

        <!-- <AppSettings /> -->
      </div>

      <Toaster :theme="colorMode.preference as any || 'system'" position="top-right" />
      <PagerAlert />
    </ConfigProvider>
  </Body>
</template>
