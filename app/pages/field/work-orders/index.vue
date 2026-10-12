<script setup lang="ts">
import type { FieldAsset, WorkOrder, WorkOrderStatus } from '~/types/field'
import type { TicketPriority } from '~/types/ticket'
import { toast } from 'vue-sonner'
import { WORK_ORDER_STATUSES } from '~/types/field'

definePageMeta({ middleware: 'agent' })

const route = useRoute()
const { isAdmin, currentUser } = useAuth()
const isDispatcher = computed(() => isAdmin.value || (currentUser.value?.roles ?? []).some(r => ['agent', 'engineering_coordinator', 'engineering_lead'].includes(r)))
const { clients, fetchClients } = useClients()

const VIEWS = [
  { value: 'all', label: 'All work orders' },
  { value: 'mine', label: 'Assigned to me' },
] as const
const view = ref<string>('all')
const isNewOpen = ref(false)
const workOrders = ref<WorkOrder[]>([])
const assets = ref<FieldAsset[]>([])
const loading = ref(true)

async function load() {
  loading.value = true
  try {
    workOrders.value = (await fetchUntyped<{ workOrders: WorkOrder[] }>('/api/field/work-orders', { query: view.value === 'mine' ? { mine: '1' } : {} })).workOrders
  }
  finally {
    loading.value = false
  }
}

watch(view, load)

onMounted(async () => {
  if (!isDispatcher.value)
    view.value = 'mine'
  await load()
  if (isDispatcher.value) {
    await fetchClients()
    assets.value = (await fetchUntyped<{ assets: FieldAsset[] }>('/api/field/assets')).assets
  }
  if (route.query.new === '1' && isDispatcher.value)
    isNewOpen.value = true
})

type StatusFilter = 'all' | 'open' | WorkOrderStatus
const statusFilter = ref<StatusFilter>('open')
const OPEN = new Set<WorkOrderStatus>(['unscheduled', 'scheduled', 'travelling', 'in_progress'])
const matches = (order: WorkOrder, filter: StatusFilter) => filter === 'all' || (filter === 'open' ? OPEN.has(order.status) : order.status === filter)
const statusTabs = computed(() => (['open', 'unscheduled', 'completed', 'cancelled', 'all'] as StatusFilter[]).map(value => ({
  value,
  label: value === 'open' ? 'Open' : value === 'all' ? 'All' : WORK_ORDER_STATUSES.find(s => s.value === value)!.label,
  count: workOrders.value.filter(o => matches(o, value)).length,
})))
const visible = computed(() => workOrders.value.filter(o => matches(o, statusFilter.value)))

const statusLabel = (status: WorkOrderStatus) => WORK_ORDER_STATUSES.find(s => s.value === status)?.label ?? status
const STATUS_CLASS: Record<WorkOrderStatus, string> = {
  unscheduled: 'bg-brand-mist text-brand-forest',
  scheduled: 'bg-brand-forest text-brand-lime',
  travelling: 'bg-brand-lime text-brand-forest',
  in_progress: 'bg-brand-lime text-brand-forest',
  completed: 'bg-brand-spruce text-white',
  cancelled: 'bg-muted text-muted-foreground',
}
const when = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'

function exportList() {
  downloadCsv('work-orders.csv', ['ID', 'Title', 'Client', 'Asset', 'Location', 'Priority', 'Skill', 'Duration (min)', 'Status', 'Technician', 'Scheduled', 'SLA due', 'Completed', 'Ticket'], visible.value.map(o => [
    o.id,
    o.title,
    o.clientName,
    o.assetName,
    o.location,
    o.priority,
    o.skill,
    o.durationMinutes,
    statusLabel(o.status),
    o.technicianName,
    o.scheduledStart?.slice(0, 16).replace('T', ' '),
    o.slaDueAt?.slice(0, 16).replace('T', ' '),
    o.completedAt?.slice(0, 16).replace('T', ' '),
    o.ticketId,
  ]))
}

// ── New work order ────────────────────────────────────────────────────────
const form = reactive({
  title: '',
  clientId: '',
  assetId: '',
  location: '',
  priority: 'medium' as TicketPriority,
  skill: '',
  durationMinutes: 60,
  slaDueAt: '',
  tasks: '',
  description: '',
})
const clientAssets = computed(() => assets.value.filter(a => !form.clientId || a.clientId === form.clientId))
watch(() => form.assetId, (id) => {
  const asset = assets.value.find(a => a.id === id)
  if (asset?.location && !form.location)
    form.location = asset.location
  if (asset?.clientId && !form.clientId)
    form.clientId = asset.clientId
})
const saving = ref(false)
async function createWorkOrder() {
  saving.value = true
  try {
    const { workOrder } = await fetchUntyped<{ workOrder: WorkOrder }>('/api/field/work-orders', {
      method: 'POST',
      body: {
        ...form,
        clientId: form.clientId || undefined,
        assetId: form.assetId || undefined,
        slaDueAt: form.slaDueAt ? new Date(form.slaDueAt).toISOString() : undefined,
        tasks: form.tasks.split('\n'),
      },
    })
    workOrders.value.unshift(workOrder)
    isNewOpen.value = false
    Object.assign(form, { title: '', clientId: '', assetId: '', location: '', priority: 'medium', skill: '', durationMinutes: 60, slaDueAt: '', tasks: '', description: '' })
    toast(`${workOrder.id} created`, { description: 'It\'s waiting on the schedule board.', action: { label: 'Open board', onClick: () => navigateTo('/field') } })
  }
  catch (error: any) {
    toast.error('Could not create the work order', { description: error?.data?.statusMessage })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <FieldNav />

    <PageActions v-if="isDispatcher" label="Work order actions">
      <Button variant="lime" @click="isNewOpen = true">
        <Icon name="i-lucide-plus" />
        New work order
      </Button>
      <Button variant="ghost" :disabled="!visible.length" @click="exportList">
        <Icon name="i-lucide-download" />
        Export
      </Button>
    </PageActions>

    <PageTitle v-model:view="view" title="Work orders" :views="isDispatcher ? VIEWS : undefined">
      <template #aside>
        <PageSegmentedTabs v-model="statusFilter" label="Status" :options="statusTabs" />
      </template>
    </PageTitle>

    <div class="rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Work order</TableHead>
            <TableHead>Client · location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Technician</TableHead>
            <TableHead>Scheduled</TableHead>
            <TableHead>SLA</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="order in visible" :key="order.id" class="cursor-pointer" @click="navigateTo(`/field/work-orders/${order.id}`)">
            <TableCell>
              <NuxtLink :to="`/field/work-orders/${order.id}`" class="font-semibold text-foreground hover:underline" @click.stop>
                {{ order.title }}
              </NuxtLink>
              <div class="text-xs text-muted-foreground">
                {{ order.id }} · {{ order.priority }}<template v-if="order.skill">
                  · {{ order.skill }}
                </template>
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ [order.clientName, order.location].filter(Boolean).join(' · ') || '—' }}
            </TableCell>
            <TableCell>
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="STATUS_CLASS[order.status]">{{ statusLabel(order.status) }}</span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ order.technicianName ?? '—' }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ when(order.scheduledStart) }}
            </TableCell>
            <TableCell :class="order.slaDueAt && new Date(order.slaDueAt) < new Date() && OPEN.has(order.status) ? 'font-semibold text-destructive' : 'text-muted-foreground'">
              {{ when(order.slaDueAt) }}
            </TableCell>
          </TableRow>
          <TableRow v-if="!visible.length">
            <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
              {{ loading ? 'Loading…' : 'No work orders here.' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Sheet v-model:open="isNewOpen">
      <SheetContent side="right" class="w-full overflow-y-auto p-6 sm:max-w-xl">
        <SheetHeader class="p-0">
          <SheetTitle>New work order</SheetTitle>
          <SheetDescription>A site visit for a technician. It goes to "To schedule" on the board.</SheetDescription>
        </SheetHeader>
        <form class="mt-4 flex flex-col gap-4" @submit.prevent="createWorkOrder">
          <div class="flex flex-col gap-1.5">
            <Label for="wo-title">Title</Label>
            <Input id="wo-title" v-model="form.title" placeholder="e.g. Gate 2 loop sensor" />
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label for="wo-client">Client</Label>
              <Select v-model="form.clientId">
                <SelectTrigger id="wo-client" class="w-full">
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="client in clients" :key="client.id" :value="client.id">
                    {{ client.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="wo-asset">Asset</Label>
              <Select v-model="form.assetId">
                <SelectTrigger id="wo-asset" class="w-full">
                  <SelectValue :placeholder="clientAssets.length ? 'Optional' : 'No assets yet'" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="asset in clientAssets" :key="asset.id" :value="asset.id">
                    {{ asset.name }}{{ asset.serial ? ` · ${asset.serial}` : '' }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="wo-location">Site address</Label>
            <Input id="wo-location" v-model="form.location" placeholder="e.g. Main gate, Harbour Rd, Tema" />
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div class="flex flex-col gap-1.5">
              <Label for="wo-priority">Priority</Label>
              <Select v-model="form.priority">
                <SelectTrigger id="wo-priority" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="p in ['low', 'medium', 'high', 'urgent']" :key="p" :value="p">
                    {{ p[0]!.toUpperCase() + p.slice(1) }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="wo-skill">Skill needed</Label>
              <Input id="wo-skill" v-model="form.skill" placeholder="e.g. HVAC" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="wo-duration">Duration (min)</Label>
              <Input id="wo-duration" v-model.number="form.durationMinutes" type="number" min="15" max="720" step="15" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="wo-sla">On site by (SLA)</Label>
            <Input id="wo-sla" v-model="form.slaDueAt" type="datetime-local" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="wo-tasks">Service tasks</Label>
            <Textarea id="wo-tasks" v-model="form.tasks" rows="4" placeholder="One per line, e.g.&#10;Isolate barrier power&#10;Inspect loop wiring &amp; seal" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="wo-description">Notes for the technician</Label>
            <Textarea id="wo-description" v-model="form.description" rows="3" />
          </div>
          <SheetFooter class="p-0">
            <Button type="submit" :disabled="saving || form.title.trim().length < 3">
              Create work order
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  </div>
</template>
