<script setup lang="ts">
// The website chat on its own (/widget/<workspace>), for the embed code: public/widget.js puts it in an iframe on
// the company's own website). Same chat, AI agent and inbox as the support portal's button.
definePageMeta({ layout: 'blank' })

const route = useRoute()
const workspace = computed(() => String(route.params.workspace).toLowerCase())
const { data, error } = await useFetch(() => `/api/portal/${workspace.value}`)
const companyName = computed(() => data.value?.workspace.isHome ? 'Canopy' : (data.value?.workspace.name ?? ''))
useSeoMeta({ title: () => `${companyName.value || 'Support'} chat`, robots: 'noindex' })
</script>

<template>
  <PortalChatWidget v-if="data?.chat.enabled" :workspace="workspace" :company-name="companyName" :title="data.chat.title" embedded />
  <p v-else class="m-0 flex h-dvh items-center justify-center p-6 text-center text-sm text-[#5d605d]">
    {{ error ? 'This chat isn\'t available.' : 'Live chat is switched off right now.' }}
  </p>
</template>
