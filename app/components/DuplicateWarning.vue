<script setup lang="ts">
import type { DuplicateCheckEntity, DuplicateMatch } from '~/composables/useDuplicateCheck'

const props = defineProps<{
  entity: 'clients' | 'leads'
  matches: DuplicateMatch[]
}>()

const ENTITY_LABEL: Record<DuplicateCheckEntity, string> = {
  clients: 'Client',
  leads: 'Lead',
  tenders: 'Tender',
}

const REASON_LABEL: Record<DuplicateMatch['reason'], string> = {
  name: 'same name',
  email: 'same email',
  phone: 'same phone',
}

const blocking = computed(() => props.matches.find(match => match.entity === props.entity && match.reason === 'name'))
const warnings = computed(() => props.matches.filter(match => match !== blocking.value))
const singular = computed(() => ENTITY_LABEL[props.entity].toLowerCase())
</script>

<template>
  <div v-if="matches.length" class="flex flex-col gap-2">
    <Alert v-if="blocking" variant="destructive">
      <Icon name="i-lucide-octagon-x" class="h-4 w-4" />
      <AlertTitle>This {{ singular }} already exists</AlertTitle>
      <AlertDescription>
        "{{ blocking.label }}" ({{ blocking.id }}, {{ blocking.stage }}) has the same name. Open the existing {{ singular }}
        instead of adding a duplicate. Names are compared ignoring case, punctuation and endings like Ltd/Limited/Inc.
      </AlertDescription>
    </Alert>

    <Alert v-if="warnings.length">
      <Icon name="i-lucide-triangle-alert" class="h-4 w-4" />
      <AlertTitle>Possible duplicate</AlertTitle>
      <AlertDescription>
        <ul class="list-disc pl-4">
          <li v-for="match in warnings" :key="`${match.entity}-${match.id}`">
            {{ ENTITY_LABEL[match.entity] }} "{{ match.label }}" ({{ match.stage }}): {{ REASON_LABEL[match.reason] }}
          </li>
        </ul>
        <span v-if="entity === 'clients' && warnings.some(m => m.entity === 'leads' && m.reason === 'name')">
          If that lead has been won, convert it into a client instead of adding a new one.
        </span>
        <span v-else>You can still save if this is a different {{ singular }}.</span>
      </AlertDescription>
    </Alert>
  </div>
</template>
