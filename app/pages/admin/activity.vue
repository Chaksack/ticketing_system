<script setup lang="ts">
interface ActivityLogEntry {
  id: string
  source: 'ticket' | 'client' | 'lead'
  entityId: string
  entityLabel: string
  type: string
  actorId?: string
  actorName?: string
  fromValue?: string
  toValue?: string
  message?: string
  createdAt: string
}

definePageMeta({
  middleware: 'admin',
})

const { staff, fetchStaff } = useStaff()

const activity = ref<ActivityLogEntry[]>([])
const isLoading = ref(false)
const staffFilter = ref('all')
const sourceFilter = ref('all')

async function fetchActivity() {
  isLoading.value = true
  try {
    const { activity: rows } = await $fetch<{ activity: ActivityLogEntry[] }>('/api/admin/activity', {
      query: staffFilter.value !== 'all' ? { staffId: staffFilter.value } : {},
    })
    activity.value = rows
  }
  finally {
    isLoading.value = false
  }
}

onMounted(async () => {
  if (!staff.value.length)
    await fetchStaff()
  await fetchActivity()
})

watch(staffFilter, fetchActivity)

const filteredActivity = computed(() => {
  return activity.value.filter((entry) => {
    if (sourceFilter.value !== 'all' && entry.source !== sourceFilter.value)
      return false
    return true
  })
})

const SOURCE_LABEL: Record<ActivityLogEntry['source'], string> = {
  ticket: 'Ticket',
  client: 'Client',
  lead: 'Lead',
}

const SOURCE_BADGE_CLASS: Record<ActivityLogEntry['source'], string> = {
  ticket: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  client: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30',
  lead: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
}

const SOURCE_LINK: Record<ActivityLogEntry['source'], (id: string) => string> = {
  ticket: id => `/tickets?open=${id}`,
  client: id => `/clients?open=${id}`,
  lead: id => `/leads?open=${id}`,
}

function activityLabel(entry: ActivityLogEntry) {
  if (entry.message)
    return entry.message

  const type = entry.type.replaceAll('_', ' ')
  if (entry.fromValue && entry.toValue)
    return `${type}: ${entry.fromValue} → ${entry.toValue}`
  if (entry.toValue)
    return `${type}: ${entry.toValue}`
  return type
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Activity Log
        </h2>
        <p class="text-muted-foreground">
          Review activity across tickets, clients, and leads — filter by staff member to audit their work.
        </p>
      </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <Select v-model="staffFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All staff
          </SelectItem>
          <SelectItem v-for="member in staff" :key="member.id" :value="member.id">
            {{ member.name }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="sourceFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All types
          </SelectItem>
          <SelectItem value="ticket">
            Tickets
          </SelectItem>
          <SelectItem value="client">
            Clients
          </SelectItem>
          <SelectItem value="lead">
            Leads
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Entity</TableHead>
            <TableHead>Activity</TableHead>
            <TableHead>Staff</TableHead>
            <TableHead>When</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredActivity.length">
            <TableRow v-for="entry in filteredActivity" :key="`${entry.source}-${entry.id}`">
              <TableCell>
                <Badge variant="outline" :class="SOURCE_BADGE_CLASS[entry.source]">
                  {{ SOURCE_LABEL[entry.source] }}
                </Badge>
              </TableCell>
              <TableCell class="font-medium">
                <NuxtLink :to="SOURCE_LINK[entry.source](entry.entityId)" class="hover:underline">
                  {{ entry.entityLabel }}
                </NuxtLink>
              </TableCell>
              <TableCell class="text-muted-foreground max-w-md truncate">
                {{ activityLabel(entry) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ entry.actorName || 'System' }}
              </TableCell>
              <TableCell class="text-muted-foreground whitespace-nowrap">
                {{ formatDateTime(entry.createdAt) }}
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              {{ isLoading ? 'Loading activity…' : 'No activity matches your filters.' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
