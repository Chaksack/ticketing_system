<script setup lang="ts">
// Public: the unsubscribe link at the bottom of every journey email. One click, then confirmed.
definePageMeta({ layout: 'blank' })
useSeoMeta({ title: 'Unsubscribe' })

const route = useRoute()
const state = ref<'ready' | 'done' | 'error'>('ready')
const message = ref('')

async function unsubscribe() {
  try {
    await $fetch('/api/public/unsubscribe', { method: 'POST', query: { workspace: String(route.params.workspace) }, body: { messageId: String(route.params.id) } })
    state.value = 'done'
  }
  catch (e: any) {
    state.value = 'error'
    message.value = e?.data?.statusMessage ?? 'Something went wrong. Please try again.'
  }
}
</script>

<template>
  <div class="flex min-h-screen items-start justify-center bg-[#f6f7f5] px-4 py-16 font-sans text-[#454745]">
    <div class="flex w-full max-w-md flex-col gap-4 rounded-[28px] bg-white p-8 ring-1 ring-black/10">
      <template v-if="state === 'done'">
        <h1 class="m-0 text-2xl font-black tracking-[-0.03em] text-brand-obsidian">
          You're unsubscribed
        </h1>
        <p class="m-0">
          You won't get any more of these emails. Replies about your support requests aren't affected.
        </p>
      </template>
      <template v-else>
        <h1 class="m-0 text-2xl font-black tracking-[-0.03em] text-brand-obsidian">
          Unsubscribe from these emails?
        </h1>
        <p class="m-0">
          You'll stop receiving marketing emails from this company. Support emails about your requests still reach you.
        </p>
        <p v-if="state === 'error'" role="alert" class="m-0 text-sm font-semibold text-[#a11f26]">
          {{ message }}
        </p>
        <button type="button" class="min-h-12 rounded-full bg-brand-forest font-semibold text-brand-lime" @click="unsubscribe">
          Unsubscribe
        </button>
      </template>
    </div>
  </div>
</template>
