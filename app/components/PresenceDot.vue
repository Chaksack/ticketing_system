<script setup lang="ts">
import type { PresenceState } from '~/types/presence'

withDefaults(defineProps<{
  state?: PresenceState
  size?: 'sm' | 'md'
}>(), {
  size: 'sm',
})

const COLOR_CLASS: Record<PresenceState, string> = {
  online: 'bg-emerald-500',
  away: 'bg-amber-500',
  in_meeting: 'bg-violet-500',
  offline: 'bg-slate-400',
}

const LABEL: Record<PresenceState, string> = {
  online: 'Online',
  away: 'Away',
  in_meeting: 'In a meeting',
  offline: 'Offline',
}
</script>

<template>
  <span
    v-if="state"
    class="block shrink-0 rounded-full ring-2 ring-background"
    :class="[COLOR_CLASS[state], size === 'sm' ? 'size-2.5' : 'size-3']"
    :title="LABEL[state]"
  />
</template>
