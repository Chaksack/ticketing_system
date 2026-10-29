<script setup lang="ts">
import type { SupportAgent } from '~/types/supportDesk'
import { toast } from 'vue-sonner'

// Support setup → Support agents: the people on the desk — who's online, on shift and on call, and
// how much each is carrying right now. Add or edit people in Admin → Staff.
definePageMeta({ middleware: 'agent' })

const { isAdmin } = useAuth()
const agents = ref<SupportAgent[] | null>(null)
async function load() {
  agents.value = (await fetchUntyped<{ agents: SupportAgent[] }>('/api/service/agents')).agents
}
onMounted(load)

const PRESENCE: Record<SupportAgent['presence'], { label: string, dot: string }> = {
  online: { label: 'Online', dot: 'bg-emerald-500' },
  away: { label: 'Away', dot: 'bg-amber-400' },
  in_meeting: { label: 'In a meeting', dot: 'bg-violet-500' },
  offline: { label: 'Offline', dot: 'bg-[#868685]' },
}
const ROLE_LABELS: Record<string, string> = { admin: 'Admin', agent: 'Support agent', engineer: 'Engineer', engineering_coordinator: 'Eng. coordinator', engineering_lead: 'Eng. lead' }
const summary = computed(() => ({
  online: (agents.value ?? []).filter(a => a.presence === 'online').length,
  onShift: (agents.value ?? []).filter(a => a.onShift).length,
  onCall: (agents.value ?? []).filter(a => a.onCall).length,
  openTickets: (agents.value ?? []).reduce((sum, a) => sum + a.openTickets, 0),
}))

async function setOnCall(agent: SupportAgent, onCall: boolean) {
  try {
    await fetchUntyped(`/api/staff/${agent.id}`, { method: 'PATCH', body: { onCall } })
    agent.onCall = onCall
    toast(onCall ? `${agent.name} is on call` : `${agent.name} is off call`)
  }
  catch (error: any) {
    toast.error('Not changed', { description: error?.data?.statusMessage })
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="Support agent actions">
      <Button v-if="isAdmin" variant="lime" as-child>
        <NuxtLink to="/admin">
          <Icon name="i-lucide-user-plus" />
          Add or edit people
        </NuxtLink>
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/service/schedules">
          <Icon name="i-lucide-calendar-range" />
          Team schedules
        </NuxtLink>
      </Button>
      <Button variant="ghost" @click="load">
        <Icon name="i-lucide-refresh-cw" />
        Refresh
      </Button>
    </PageActions>

    <PageTitle title="Support agents" description="The people who answer cases and chats: who's available now and how much each is carrying." />

    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div
        v-for="tile in [
          { label: 'Online now', value: summary.online },
          { label: 'On shift now', value: summary.onShift },
          { label: 'On call', value: summary.onCall },
          { label: 'Open cases assigned', value: summary.openTickets },
        ]" :key="tile.label" class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div class="text-sm text-muted-foreground">
          {{ tile.label }}
        </div>
        <div class="mt-1 text-4xl font-black tracking-[-0.04em] text-foreground">
          {{ agents ? tile.value : '—' }}
        </div>
      </div>
    </div>

    <div class="overflow-x-auto rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Agent</TableHead>
            <TableHead>Now</TableHead>
            <TableHead>Today's shift</TableHead>
            <TableHead class="text-right">
              Open cases
            </TableHead>
            <TableHead class="text-right">
              Live chats
            </TableHead>
            <TableHead class="text-right">
              Resolved (7 days)
            </TableHead>
            <TableHead class="text-right">
              Rating
            </TableHead>
            <TableHead>On call</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!agents">
            <TableCell :colspan="8" class="h-20 text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
          <TableRow v-for="agent in agents ?? []" :key="agent.id">
            <TableCell>
              <div class="font-semibold text-foreground">
                {{ agent.name }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ agent.roles.map(r => ROLE_LABELS[r] ?? r).join(', ') }}<template v-if="agent.status === 'pending'">
                  · invite pending
                </template>
              </div>
            </TableCell>
            <TableCell>
              <span class="flex items-center gap-1.5 text-sm"><span class="size-2 rounded-full" :class="PRESENCE[agent.presence].dot" />{{ PRESENCE[agent.presence].label }}</span>
              <span v-if="agent.onShift" class="mt-0.5 inline-block rounded-full bg-brand-mist px-2 py-0.5 text-xs font-semibold text-brand-forest dark:bg-brand-spruce dark:text-brand-mist">On shift</span>
            </TableCell>
            <TableCell class="text-sm text-muted-foreground">
              {{ agent.shiftToday ?? 'Not on the rota' }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ agent.openTickets }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ agent.activeChats }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ agent.resolvedThisWeek }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ agent.rating ? `${agent.rating.toFixed(1)} / 5` : '—' }}
            </TableCell>
            <TableCell>
              <label class="flex items-center gap-2 text-sm">
                <Switch :model-value="agent.onCall" :disabled="!isAdmin" :aria-label="`${agent.name} on call`" @update:model-value="(value: boolean) => setOnCall(agent, value)" />
                {{ agent.onCall ? 'Yes' : 'No' }}
              </label>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <p class="m-0 text-xs text-muted-foreground">
      People on call are notified when a customer is waiting in live chat. Ratings come from satisfaction surveys on resolved cases.
    </p>
  </div>
</template>
