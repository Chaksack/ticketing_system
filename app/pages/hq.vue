<script setup lang="ts">
import type { AuditEntry } from '~/types/organization'

// Canopy HQ home — Canopy's internal view of the platform: the client companies it serves, who
// is being onboarded, Canopy Care queues, and which clients have SLA trouble right now.
definePageMeta({ middleware: 'care-agent' })

interface Summary {
  isPlatform: boolean
  clients: { total: number, active: number, suspended: number, newThisWeek: number } | null
  health: { orgId: string, name: string, slug: string, status: string, plan: string, openTickets: number | null, breachedTickets: number | null, waitingChats: number | null, care: string | null }[]
  onboarding: { id: string, clientName: string, status: string, plan: string, ownerName?: string, updatedAt: string }[]
  care: { engagements: number, live: number, inSetup: number, myClients: number, waiting: number }
  recentAudit: AuditEntry[]
}

const { currentUser } = useAuth()
const data = ref<Summary | null>(null)
const error = ref('')
async function load() {
  try {
    data.value = await fetchUntyped<Summary>('/api/hq/summary')
  }
  catch (e: any) {
    error.value = e?.data?.statusMessage ?? 'Could not load HQ.'
  }
}
onMounted(load)

const breached = computed(() => data.value?.health.reduce((sum, h) => sum + (h.breachedTickets ?? 0), 0) ?? 0)
const greeting = computed(() => {
  const hour = new Date().getHours()
  return `${hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'}, ${currentUser.value?.name.split(' ')[0] ?? ''}`
})
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const STATUS_CLASS: Record<string, string> = { active: 'bg-brand-forest text-brand-lime', suspended: 'bg-destructive/10 text-destructive' }
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
    <PageActions label="HQ actions">
      <Button v-if="data?.isPlatform" variant="lime" as-child>
        <NuxtLink to="/console/onboarding">
          <Icon name="i-lucide-plus" /> Onboard a client
        </NuxtLink>
      </Button>
      <Button v-if="data?.isPlatform" variant="ghost" as-child>
        <NuxtLink to="/console/tenants">
          Client companies
        </NuxtLink>
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/care/desktop">
          Care desktop
        </NuxtLink>
      </Button>
    </PageActions>

    <div>
      <div class="text-[15px] text-muted-foreground">
        {{ greeting }}
      </div>
      <h1 class="m-0 mt-1 text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
        Canopy HQ
      </h1>
      <p class="mt-2 text-muted-foreground">
        The companies Canopy serves, who's being onboarded, and the customer service Canopy Care runs for them.
      </p>
    </div>

    <p v-if="error" role="alert" class="rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
      {{ error }}
    </p>

    <template v-if="data">
      <div class="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-5">
        <NuxtLink v-if="data.clients" to="/console/tenants" class="rounded-[28px] bg-brand-forest p-5 transition-opacity hover:opacity-95">
          <div class="text-sm text-brand-mist">
            Client companies
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-brand-lime">
            {{ data.clients.active }}
          </div>
          <div class="text-[13px] text-white">
            active of {{ data.clients.total }}<template v-if="data.clients.newThisWeek">
              · {{ data.clients.newThisWeek }} new this week
            </template>
          </div>
        </NuxtLink>
        <NuxtLink v-if="data.isPlatform" to="/console/onboarding" class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 hover:ring-brand-forest dark:ring-white/10">
          <div class="text-sm text-muted-foreground">
            Onboarding
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-foreground">
            {{ data.onboarding.length }}
          </div>
          <div class="text-[13px] text-muted-foreground">
            {{ data.onboarding.filter(o => o.status === 'signed').length }} signed, ready to provision
          </div>
        </NuxtLink>
        <div v-if="data.isPlatform" class="rounded-[28px] p-5" :class="breached ? 'bg-destructive/10' : 'bg-card ring-1 ring-black/10 dark:ring-white/10'">
          <div class="text-sm" :class="breached ? 'text-destructive' : 'text-muted-foreground'">
            Overdue client tickets
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em]" :class="breached ? 'text-destructive' : 'text-foreground'">
            {{ breached }}
          </div>
          <div class="text-[13px]" :class="breached ? 'text-destructive' : 'text-muted-foreground'">
            Past their resolution SLA, all clients
          </div>
        </div>
        <NuxtLink :to="data.isPlatform ? '/care' : '/care/desktop'" class="rounded-[28px] bg-card p-5 ring-1 ring-black/10 hover:ring-brand-forest dark:ring-white/10">
          <div class="text-sm text-muted-foreground">
            Canopy Care
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-foreground">
            {{ data.isPlatform ? data.care.live : data.care.myClients }}
          </div>
          <div class="text-[13px] text-muted-foreground">
            {{ data.isPlatform ? `live · ${data.care.inSetup} in setup` : 'clients you answer for' }}
          </div>
        </NuxtLink>
        <NuxtLink to="/care/desktop" class="rounded-[28px] bg-brand-mist p-5 dark:bg-brand-spruce">
          <div class="text-sm text-brand-spruce dark:text-brand-mist">
            Waiting for Care
          </div>
          <div class="mt-1.5 text-[38px] font-black leading-tight tracking-[-0.04em] text-brand-forest dark:text-brand-lime">
            {{ data.care.waiting }}
          </div>
          <div class="text-[13px] text-brand-forest dark:text-white">
            Customers in live chat right now
          </div>
        </NuxtLink>
      </div>

      <div v-if="data.isPlatform" class="flex flex-wrap items-start gap-4">
        <RecordCard title="Client health" class="min-w-0 flex-[999_1_560px]">
          <template #actions>
            <NuxtLink to="/console/tenants" class="text-sm font-medium text-primary hover:underline dark:text-brand-lime">
              All clients
            </NuxtLink>
          </template>
          <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Status</TableHead>
                <TableHead class="text-right">
                  Open tickets
                </TableHead>
                <TableHead class="text-right">
                  Overdue
                </TableHead>
                <TableHead class="text-right">
                  Chats waiting
                </TableHead>
                <TableHead>Care</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="client in data.health" :key="client.orgId" class="cursor-pointer" @click="navigateTo(`/console/tenants/${client.orgId}`)">
                <TableCell>
                  <NuxtLink :to="`/console/tenants/${client.orgId}`" class="font-semibold text-foreground hover:underline" @click.stop>
                    {{ client.name }}
                  </NuxtLink>
                  <div class="text-xs text-muted-foreground">
                    {{ client.slug }} · {{ client.plan }}
                  </div>
                </TableCell>
                <TableCell>
                  <span class="rounded-full px-2.5 py-1 text-xs font-semibold capitalize" :class="STATUS_CLASS[client.status] ?? 'bg-muted text-muted-foreground'">{{ client.status }}</span>
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ client.openTickets ?? '—' }}
                </TableCell>
                <TableCell class="text-right tabular-nums" :class="client.breachedTickets ? 'font-bold text-destructive' : ''">
                  {{ client.breachedTickets ?? '—' }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ client.waitingChats ?? '—' }}
                </TableCell>
                <TableCell class="capitalize text-muted-foreground">
                  {{ client.care ?? '—' }}
                </TableCell>
              </TableRow>
              <TableRow v-if="!data.health.length">
                <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
                  No client companies yet. <NuxtLink to="/console/onboarding" class="underline">
                    Onboard the first one
                  </NuxtLink>.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </RecordCard>

        <aside class="flex flex-[1_1_300px] flex-col gap-4 xl:max-w-[400px]">
          <RecordCard title="Onboarding pipeline" tone="mist">
            <NuxtLink v-for="item in data.onboarding" :key="item.id" :to="`/console/onboarding/${item.id}`" class="flex items-center justify-between gap-2 rounded-xl bg-card px-3 py-2.5 text-sm text-foreground hover:ring-1 hover:ring-brand-forest">
              <span class="min-w-0">
                <span class="block truncate font-semibold">{{ item.clientName }}</span>
                <span class="block text-xs text-muted-foreground">{{ item.ownerName ?? 'No owner' }} · {{ item.plan }}</span>
              </span>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold capitalize" :class="item.status === 'signed' ? 'bg-brand-lime text-brand-forest' : 'bg-muted text-muted-foreground'">{{ item.status }}</span>
            </NuxtLink>
            <p v-if="!data.onboarding.length" class="m-0 text-sm">
              Nobody is being onboarded right now.
            </p>
          </RecordCard>
          <RecordCard title="Recent staff activity">
            <div v-for="entry in data.recentAudit" :key="entry.id" class="border-b border-border pb-2 text-sm last:border-0">
              <span class="font-semibold text-foreground">{{ entry.actorName ?? 'System' }}</span> {{ entry.action.replace(/[._]/g, ' ') }}<template v-if="entry.orgId">
                · {{ entry.orgId }}
              </template>
              <div class="text-xs text-muted-foreground">
                {{ when(entry.at) }}
              </div>
            </div>
            <p v-if="!data.recentAudit.length" class="m-0 text-sm text-muted-foreground">
              Nothing yet.
            </p>
          </RecordCard>
        </aside>
      </div>
    </template>
    <p v-else-if="!error" class="text-sm text-muted-foreground">
      Loading…
    </p>
  </div>
</template>
