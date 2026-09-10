<script setup lang="ts">
import type { RegardingType } from '~/types/interaction'

const props = defineProps<{
  regardingType?: RegardingType
  regardingId?: string
  /** Pre-resolved label for the current selection, used before the matching list has loaded. */
  regardingLabel?: string
}>()

const emit = defineEmits<{
  'update:regardingType': [value: RegardingType | undefined]
  'update:regardingId': [value: string | undefined]
}>()

const { leads, fetchLeads } = useLeads()
const { tenders, fetchTenders } = useTenders()
const { clients, fetchClients } = useClients()

const isOpen = ref(false)
const hasLoaded = ref(false)

async function ensureLoaded() {
  if (hasLoaded.value)
    return
  hasLoaded.value = true
  await Promise.all([
    leads.value.length ? Promise.resolve() : fetchLeads(),
    tenders.value.length ? Promise.resolve() : fetchTenders(),
    clients.value.length ? Promise.resolve() : fetchClients(),
  ])
}

watch(isOpen, (open) => {
  if (open)
    ensureLoaded()
})

const selectedLabel = computed(() => {
  if (!props.regardingType || !props.regardingId)
    return undefined

  if (props.regardingType === 'lead')
    return leads.value.find(l => l.id === props.regardingId)?.name ?? props.regardingLabel
  if (props.regardingType === 'tender')
    return tenders.value.find(t => t.id === props.regardingId)?.title ?? props.regardingLabel
  return clients.value.find(c => c.id === props.regardingId)?.name ?? props.regardingLabel
})

function select(type: RegardingType, id: string) {
  emit('update:regardingType', type)
  emit('update:regardingId', id)
  isOpen.value = false
}

function clear() {
  emit('update:regardingType', undefined)
  emit('update:regardingId', undefined)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <Badge v-if="selectedLabel" variant="secondary" class="gap-1">
      {{ selectedLabel }}
      <button type="button" class="ml-0.5" @click="clear">
        <Icon name="i-lucide-x" class="h-3 w-3" />
      </button>
    </Badge>

    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <Button variant="outline" size="sm" class="h-6 gap-1 px-2 text-xs">
          <Icon name="i-lucide-plus" class="h-3 w-3" />
          {{ selectedLabel ? 'Change' : 'Link record' }}
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search leads, tenders, clients..." />
          <CommandList>
            <CommandEmpty class="p-2 text-xs text-muted-foreground">
              No matching records.
            </CommandEmpty>
            <CommandGroup heading="Leads">
              <CommandItem v-for="lead in leads" :key="lead.id" :value="`lead-${lead.name}`" @select="select('lead', lead.id)">
                <Icon v-if="regardingType === 'lead' && regardingId === lead.id" name="i-lucide-check" class="mr-2 h-3.5 w-3.5" />
                <span v-else class="mr-2 h-3.5 w-3.5 shrink-0" />
                <span class="truncate">{{ lead.name }}</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Tenders">
              <CommandItem v-for="tender in tenders" :key="tender.id" :value="`tender-${tender.title}`" @select="select('tender', tender.id)">
                <Icon v-if="regardingType === 'tender' && regardingId === tender.id" name="i-lucide-check" class="mr-2 h-3.5 w-3.5" />
                <span v-else class="mr-2 h-3.5 w-3.5 shrink-0" />
                <span class="truncate">{{ tender.title }}</span>
              </CommandItem>
            </CommandGroup>
            <CommandGroup heading="Clients">
              <CommandItem v-for="client in clients" :key="client.id" :value="`client-${client.name}`" @select="select('client', client.id)">
                <Icon v-if="regardingType === 'client' && regardingId === client.id" name="i-lucide-check" class="mr-2 h-3.5 w-3.5" />
                <span v-else class="mr-2 h-3.5 w-3.5 shrink-0" />
                <span class="truncate">{{ client.name }}</span>
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
</template>
