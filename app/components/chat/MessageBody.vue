<script setup lang="ts">
import { parseMessageBody } from '~/lib/chatMessage'

const props = defineProps<{
  body: string
}>()

const segments = computed(() => parseMessageBody(props.body))
</script>

<template>
  <span class="whitespace-pre-wrap break-words">
    <template v-for="(segment, index) in segments" :key="index">
      <NuxtLink
        v-if="segment.type === 'reference' && segment.refUrl"
        :to="segment.refUrl"
        class="inline-flex items-center rounded bg-black/10 px-1.5 py-0.5 text-xs font-semibold underline decoration-dotted underline-offset-2 hover:no-underline"
      >
        {{ segment.text }}
      </NuxtLink>
      <span v-else-if="segment.type === 'reference'" class="inline-flex items-center rounded bg-black/10 px-1.5 py-0.5 text-xs font-semibold">
        {{ segment.text }}
      </span>
      <template v-else>{{ segment.text }}</template>
    </template>
  </span>
</template>
