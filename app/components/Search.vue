<script setup lang="ts">
import { useDebounceFn } from '@vueuse/core'

interface SearchResults {
  tickets: { id: string, subject: string, requester: string }[]
  clients: { id: string, name: string, contactName: string | null }[]
  staff: { id: string, name: string, email: string }[]
  amcPlans: { id: string, name: string }[]
  leads: { id: string, name: string, contactName: string | null }[]
  tasks: { id: string, title: string, type: string }[]
  projects: { id: string, name: string, clientName: string | null }[]
}

const EMPTY_RESULTS: SearchResults = { tickets: [], clients: [], staff: [], amcPlans: [], leads: [], tasks: [], projects: [] }

const visibleNavLinks = useVisibleNavLinks()

const openCommand = ref(false)
const router = useRouter()

defineShortcuts({
  Meta_K: () => openCommand.value = true,
})

const query = ref('')
const isSearching = ref(false)
const results = ref<SearchResults>({ ...EMPTY_RESULTS })

const hasResults = computed(() =>
  results.value.tickets.length > 0
  || results.value.clients.length > 0
  || results.value.staff.length > 0
  || results.value.amcPlans.length > 0
  || results.value.leads.length > 0
  || results.value.tasks.length > 0
  || results.value.projects.length > 0,
)

const runSearch = useDebounceFn(async (q: string) => {
  if (q.trim().length < 2) {
    results.value = { ...EMPTY_RESULTS }
    isSearching.value = false
    return
  }
  try {
    results.value = await $fetch<SearchResults>('/api/search', { query: { q } })
  }
  catch {
    results.value = { ...EMPTY_RESULTS }
  }
  finally {
    isSearching.value = false
  }
}, 250)

watch(query, (q) => {
  isSearching.value = q.trim().length >= 2
  runSearch(q)
})

const inputRef = ref<HTMLInputElement>()

watch(openCommand, async (isOpen) => {
  if (isOpen) {
    await nextTick()
    // The underlying listbox auto-focuses its first item on mount; defer past that.
    setTimeout(() => inputRef.value?.focus(), 50)
  }
  else {
    query.value = ''
  }
})

function handleSelectLink(link: string) {
  router.push(link)
  openCommand.value = false
}
</script>

<template>
  <Button variant="ghost" size="icon" @click="openCommand = !openCommand">
    <Icon name="i-lucide-search" class="size-5" />
    <span class="sr-only">Search</span>
  </Button>

  <CommandDialog v-model:open="openCommand">
    <div data-slot="command-input-wrapper" class="flex h-12 items-center gap-2 border-b px-3">
      <Icon name="i-lucide-search" class="size-4 shrink-0 opacity-50" />
      <input
        ref="inputRef"
        v-model="query"
        placeholder="Search tickets, clients, leads, tasks, projects, staff..."
        class="placeholder:text-muted-foreground flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
      >
    </div>
    <CommandList>
      <template v-if="query.trim().length < 2">
        <CommandGroup heading="Pages">
          <CommandItem
            v-for="link in visibleNavLinks"
            :key="link.link"
            :value="link.title"
            class="gap-2"
            @select="handleSelectLink(link.link)"
          >
            <Icon v-if="link.icon" :name="link.icon" />
            {{ link.title }}
          </CommandItem>
        </CommandGroup>
      </template>

      <template v-else>
        <CommandGroup v-if="results.tickets.length" heading="Tickets">
          <CommandItem
            v-for="ticket in results.tickets"
            :key="ticket.id"
            :value="`ticket-${ticket.id}`"
            class="gap-2"
            @select="handleSelectLink(`/tickets?open=${ticket.id}`)"
          >
            <Icon name="i-lucide-ticket" />
            <span class="flex flex-col">
              <span>{{ ticket.subject }}</span>
              <span class="text-xs text-muted-foreground">{{ ticket.id }} · {{ ticket.requester }}</span>
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup v-if="results.clients.length" heading="Clients">
          <CommandItem
            v-for="client in results.clients"
            :key="client.id"
            :value="`client-${client.id}`"
            class="gap-2"
            @select="handleSelectLink(`/clients?open=${client.id}`)"
          >
            <Icon name="i-lucide-building-2" />
            <span class="flex flex-col">
              <span>{{ client.name }}</span>
              <span v-if="client.contactName" class="text-xs text-muted-foreground">{{ client.contactName }}</span>
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup v-if="results.leads.length" heading="Leads">
          <CommandItem
            v-for="lead in results.leads"
            :key="lead.id"
            :value="`lead-${lead.id}`"
            class="gap-2"
            @select="handleSelectLink(`/leads?open=${lead.id}`)"
          >
            <Icon name="i-lucide-target" />
            <span class="flex flex-col">
              <span>{{ lead.name }}</span>
              <span v-if="lead.contactName" class="text-xs text-muted-foreground">{{ lead.contactName }}</span>
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup v-if="results.tasks.length" heading="Tasks">
          <CommandItem
            v-for="task in results.tasks"
            :key="task.id"
            :value="`task-${task.id}`"
            class="gap-2"
            @select="handleSelectLink('/tasks')"
          >
            <Icon name="i-lucide-calendar-check-2" />
            <span class="flex flex-col">
              <span>{{ task.title }}</span>
              <span class="text-xs text-muted-foreground capitalize">{{ task.id }} · {{ task.type }}</span>
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup v-if="results.projects.length" heading="Projects">
          <CommandItem
            v-for="project in results.projects"
            :key="project.id"
            :value="`project-${project.id}`"
            class="gap-2"
            @select="handleSelectLink(`/projects?open=${project.id}`)"
          >
            <Icon name="i-lucide-folder-kanban" />
            <span class="flex flex-col">
              <span>{{ project.name }}</span>
              <span v-if="project.clientName" class="text-xs text-muted-foreground">{{ project.clientName }}</span>
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup v-if="results.staff.length" heading="Staff">
          <CommandItem
            v-for="member in results.staff"
            :key="member.id"
            :value="`staff-${member.id}`"
            class="gap-2"
            @select="handleSelectLink(`/admin?open=${member.id}`)"
          >
            <Icon name="i-lucide-user" />
            <span class="flex flex-col">
              <span>{{ member.name }}</span>
              <span class="text-xs text-muted-foreground">{{ member.email }}</span>
            </span>
          </CommandItem>
        </CommandGroup>

        <CommandGroup v-if="results.amcPlans.length" heading="AMC Plans">
          <CommandItem
            v-for="plan in results.amcPlans"
            :key="plan.id"
            :value="`plan-${plan.id}`"
            class="gap-2"
            @select="handleSelectLink('/amc-plans')"
          >
            <Icon name="i-lucide-file-text" />
            {{ plan.name }}
          </CommandItem>
        </CommandGroup>

        <div v-if="!isSearching && !hasResults" class="py-6 text-center text-sm text-muted-foreground">
          No results found.
        </div>
      </template>
    </CommandList>
  </CommandDialog>
</template>
