<script setup lang="ts">
import type { Ticket } from '~/types/ticket'
import ProjectDetailContent from '~/components/projects/ProjectDetailContent.vue'

definePageMeta({
  middleware: 'bd',
})

const route = useRoute()
const router = useRouter()
const { projects, fetchProject } = useProjects()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find(p => p.id === projectId.value) ?? null)
const isLoading = ref(true)

const { hasApp } = useAuth()
// Customer-service tickets raised for this project (its AMC contract sets their SLA).
const projectTickets = ref<Ticket[]>([])
const openTickets = computed(() => projectTickets.value.filter(t => t.status === 'open' || t.status === 'in-progress'))

onMounted(async () => {
  try {
    await fetchProject(projectId.value)
  }
  finally {
    isLoading.value = false
  }
  if (hasApp('service'))
    projectTickets.value = (await fetchUntyped<{ tickets: Ticket[] }>('/api/tickets', { query: { projectId: projectId.value } }).catch(() => ({ tickets: [] }))).tickets
})
const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })

function onDeleted() {
  router.push('/projects')
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-4">
    <PageActions label="Project actions">
      <Button variant="ghost" size="icon" as-child aria-label="Back to projects">
        <NuxtLink to="/projects">
          <Icon name="i-lucide-arrow-left" />
        </NuxtLink>
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/timesheets">
          Timesheets
        </NuxtLink>
      </Button>
      <Button v-if="project?.clientId" variant="ghost" as-child>
        <NuxtLink :to="`/clients/${project.clientId}`">
          Open client
        </NuxtLink>
      </Button>
    </PageActions>

    <p v-if="isLoading" class="text-sm text-muted-foreground">
      Loading…
    </p>
    <p v-else-if="!project" class="text-sm text-muted-foreground">
      Project not found.
    </p>
    <div v-else class="flex flex-1 flex-col overflow-hidden rounded-[28px] bg-card ring-1 ring-black/10 dark:ring-white/10">
      <ProjectDetailContent :project="project" @deleted="onDeleted" />
    </div>

    <RecordCard v-if="project && hasApp('service')" title="Customer service">
      <template #actions>
        <Button size="sm" variant="outline" as-child>
          <NuxtLink :to="{ path: '/tickets', query: { new: '1', clientId: project.clientId, projectId: project.id } }">
            <Icon name="i-lucide-plus" /> New ticket
          </NuxtLink>
        </Button>
      </template>
      <p class="m-0 text-sm text-muted-foreground">
        {{ openTickets.length }} open of {{ projectTickets.length }} ticket{{ projectTickets.length === 1 ? '' : 's' }} for this project. Tickets on a project with an active AMC contract use that plan's SLA.
      </p>
      <NuxtLink v-for="ticket in projectTickets" :key="ticket.id" :to="`/tickets/${ticket.id}`" class="flex flex-wrap justify-between gap-2 border-b border-border py-2.5 text-sm last:border-0 hover:underline">
        <span class="font-semibold text-foreground">{{ ticket.id }} · {{ ticket.subject }}</span>
        <span class="text-muted-foreground">{{ ticket.status }} · {{ ticket.priority }}{{ ticket.entitlement ? ` · ${ticket.entitlement}` : '' }} · {{ when(ticket.createdAt) }}</span>
      </NuxtLink>
    </RecordCard>
  </div>
</template>
