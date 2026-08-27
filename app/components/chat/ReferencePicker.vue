<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'
import { insertReferenceToken } from '~/lib/chatMessage'

const emit = defineEmits<{
  (e: 'insert', token: string): void
}>()

const isOpen = ref(false)
const query = ref('')
const isLoading = ref(false)

interface ReferenceOption {
  id: string
  label: string
  group: string
}

const results = ref<ReferenceOption[]>([])

const runSearch = useDebounceFn(async (q: string) => {
  if (q.trim().length < 2) {
    results.value = []
    return
  }

  isLoading.value = true
  try {
    const data = await $fetch<{
      tickets: { id: string, subject: string }[]
      leads: { id: string, name: string }[]
      clients: { id: string, name: string }[]
      tasks: { id: string, title: string }[]
    }>('/api/search', { query: { q } })

    results.value = [
      ...data.tickets.map(t => ({ id: t.id, label: t.subject, group: 'Tickets' })),
      ...data.leads.map(l => ({ id: l.id, label: l.name, group: 'Leads' })),
      ...data.clients.map(c => ({ id: c.id, label: c.name, group: 'Clients' })),
      ...data.tasks.map(t => ({ id: t.id, label: t.title, group: 'Tasks' })),
    ]
  }
  finally {
    isLoading.value = false
  }
}, 300)

watch(query, val => runSearch(val))

function onSelect(option: ReferenceOption) {
  emit('insert', insertReferenceToken(option.id, option.label))
  isOpen.value = false
  query.value = ''
  results.value = []
}
</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button type="button" variant="outline" size="icon-sm">
        <Icon name="i-lucide-at-sign" class="size-4" />
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[320px] p-0" align="start">
      <Command :filter-function="(list: ReferenceOption[]) => list">
        <CommandInput v-model="query" placeholder="Search tasks, leads, tickets, clients…" />
        <CommandList>
          <CommandEmpty>
            {{ query.trim().length < 2 ? 'Type at least 2 characters…' : 'No matches found.' }}
          </CommandEmpty>
          <template v-for="group in ['Tickets', 'Leads', 'Clients', 'Tasks']" :key="group">
            <CommandGroup v-if="results.some(r => r.group === group)" :heading="group">
              <CommandItem
                v-for="option in results.filter(r => r.group === group)"
                :key="option.id"
                :value="option"
                @select="onSelect(option)"
              >
                <span class="font-mono text-xs text-muted-foreground mr-2">{{ option.id }}</span>
                <span class="truncate">{{ option.label }}</span>
              </CommandItem>
            </CommandGroup>
          </template>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
