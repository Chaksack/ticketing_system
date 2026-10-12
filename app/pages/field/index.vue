<script setup lang="ts">
import type { ScheduleSuggestion, Technician, TechnicianUnavailability, WorkOrder } from '~/types/field'
import { toast } from 'vue-sonner'
import { FIELD_DAY_END_HOUR, FIELD_DAY_START_HOUR } from '~/types/field'

// Field Service schedule board ("Field Service — Schedule board" in the Canopy design).
definePageMeta({ middleware: 'agent' })

const { isAdmin, currentUser } = useAuth()
const { confirm } = useConfirm()
const isDispatcher = computed(() => isAdmin.value || (currentUser.value?.roles ?? []).some(r => ['agent', 'engineering_coordinator', 'engineering_lead'].includes(r)))
onMounted(() => {
  if (!isDispatcher.value)
    navigateTo('/field/work-orders', { replace: true })
})

const day = ref(startOfDay(new Date()))
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
const dayStart = computed(() => new Date(day.value.getFullYear(), day.value.getMonth(), day.value.getDate(), FIELD_DAY_START_HOUR))
const dayEnd = computed(() => new Date(day.value.getFullYear(), day.value.getMonth(), day.value.getDate(), FIELD_DAY_END_HOUR))
const totalMinutes = (FIELD_DAY_END_HOUR - FIELD_DAY_START_HOUR) * 60
const HOURS = Array.from({ length: FIELD_DAY_END_HOUR - FIELD_DAY_START_HOUR }, (_, i) => FIELD_DAY_START_HOUR + i)

const technicians = ref<Technician[]>([])
const workOrders = ref<WorkOrder[]>([])
const unavailability = ref<TechnicianUnavailability[]>([])
const suggestions = ref<(ScheduleSuggestion & { lateForSla: boolean })[]>([])
const unplaced = ref<{ workOrderId: string, reason: string }[]>([])

async function load() {
  const from = startOfDay(day.value)
  const to = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  const result = await fetchUntyped<{ technicians: Technician[], workOrders: WorkOrder[], unavailability: TechnicianUnavailability[] }>('/api/field/board', { query: { from: from.toISOString(), to: to.toISOString() } })
  technicians.value = result.technicians
  workOrders.value = result.workOrders
  unavailability.value = result.unavailability
}
onMounted(load)
watch(day, () => {
  suggestions.value = []
  unplaced.value = []
  load()
})

function shiftDay(days: number) {
  day.value = new Date(day.value.getFullYear(), day.value.getMonth(), day.value.getDate() + days)
}
const dayInput = computed({
  get: () => `${day.value.getFullYear()}-${String(day.value.getMonth() + 1).padStart(2, '0')}-${String(day.value.getDate()).padStart(2, '0')}`,
  set: (value: string) => {
    const [y, m, d] = value.split('-').map(Number)
    if (y && m && d)
      day.value = new Date(y, m - 1, d)
  },
})
const dayTitle = computed(() => day.value.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))

const toSchedule = computed(() => workOrders.value.filter(w => w.status === 'unscheduled').sort((a, b) => (a.slaDueAt ?? '9').localeCompare(b.slaDueAt ?? '9')))
const scheduledFor = (technicianId: string) => workOrders.value.filter(w => w.technicianId === technicianId && w.scheduledStart && w.status !== 'unscheduled')
const offFor = (technicianId: string) => unavailability.value.filter(u => u.technicianId === technicianId)
const suggestionsFor = (technicianId: string) => suggestions.value.filter(s => s.technicianId === technicianId)
const orderById = (id: string) => workOrders.value.find(w => w.id === id)

/** Position of a range on the 08:00–18:00 track, as CSS percentages (clamped to the day). */
function place(startIso: string, minutes: number) {
  const startMin = (new Date(startIso).getTime() - dayStart.value.getTime()) / 60000
  const left = Math.max(0, startMin)
  const right = Math.min(totalMinutes, startMin + minutes)
  return { left: `${(left / totalMinutes) * 100}%`, width: `${Math.max(0, right - left) / totalMinutes * 100}%` }
}

function bookedPercent(technicianId: string) {
  const minutes = scheduledFor(technicianId).reduce((sum, w) => sum + w.durationMinutes, 0)
  return Math.round((minutes / totalMinutes) * 100)
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const durationLabel = (minutes: number) => minutes % 60 ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60} min` : `${minutes / 60} h`
const initials = (name: string) => name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
const isSlaToday = (order: WorkOrder) => !!order.slaDueAt && new Date(order.slaDueAt) < new Date(day.value.getFullYear(), day.value.getMonth(), day.value.getDate() + 1)

const BLOCK_CLASS: Record<string, string> = {
  scheduled: 'bg-brand-forest text-white',
  travelling: 'bg-brand-lime text-brand-forest',
  in_progress: 'bg-brand-lime text-brand-forest',
  completed: 'bg-brand-spruce text-white',
}

// ── Scheduling ────────────────────────────────────────────────────────────
async function schedule(workOrderId: string, technicianId: string | null, scheduledStart: string | null) {
  try {
    const { workOrder } = await fetchUntyped<{ workOrder: WorkOrder }>(`/api/field/work-orders/${workOrderId}`, { method: 'PATCH', body: { technicianId, scheduledStart } })
    const index = workOrders.value.findIndex(w => w.id === workOrderId)
    if (index >= 0)
      workOrders.value[index] = workOrder
    suggestions.value = suggestions.value.filter(s => s.workOrderId !== workOrderId)
    return true
  }
  catch (error: any) {
    toast.error('Could not schedule', { description: error?.data?.statusMessage })
    return false
  }
}

// Drag a card (or an existing block) onto a technician's row; it snaps to the half hour.
function onDragStart(event: DragEvent, workOrderId: string) {
  event.dataTransfer?.setData('text/plain', workOrderId)
  if (event.dataTransfer)
    event.dataTransfer.effectAllowed = 'move'
}
async function onDrop(event: DragEvent, technicianId: string) {
  const workOrderId = event.dataTransfer?.getData('text/plain')
  const track = event.currentTarget as HTMLElement
  if (!workOrderId)
    return
  const rect = track.getBoundingClientRect()
  const order = orderById(workOrderId)
  const rawMinutes = ((event.clientX - rect.left) / rect.width) * totalMinutes
  const snapped = Math.max(0, Math.min(totalMinutes - (order?.durationMinutes ?? 60), Math.round(rawMinutes / 30) * 30))
  const start = new Date(dayStart.value.getTime() + snapped * 60000)
  if (await schedule(workOrderId, technicianId, start.toISOString()))
    toast(`${workOrderId} scheduled`, { description: `${technicians.value.find(t => t.id === technicianId)?.name} · ${clock(start.toISOString())}` })
}

// Keyboard/click alternative to dragging.
const dialogOrder = ref<WorkOrder | null>(null)
const dialogTechnician = ref('')
const dialogTime = ref('09:00')
function openScheduleDialog(order: WorkOrder) {
  dialogOrder.value = order
  dialogTechnician.value = order.technicianId ?? ''
  dialogTime.value = order.scheduledStart ? new Date(order.scheduledStart).toTimeString().slice(0, 5) : '09:00'
}
async function saveDialog() {
  if (!dialogOrder.value || !dialogTechnician.value)
    return
  const [h, m] = dialogTime.value.split(':').map(Number)
  const start = new Date(day.value.getFullYear(), day.value.getMonth(), day.value.getDate(), h ?? 9, m ?? 0)
  if (await schedule(dialogOrder.value.id, dialogTechnician.value, start.toISOString()))
    dialogOrder.value = null
}
async function unscheduleDialog() {
  if (dialogOrder.value && await schedule(dialogOrder.value.id, null, null))
    dialogOrder.value = null
}

const autoBusy = ref(false)
async function autoSchedule() {
  autoBusy.value = true
  try {
    const result = await fetchUntyped<{ suggestions: (ScheduleSuggestion & { lateForSla: boolean })[], unplaced: { workOrderId: string, reason: string }[] }>('/api/field/auto-schedule', { method: 'POST', body: { dayStart: dayStart.value.toISOString(), dayEnd: dayEnd.value.toISOString() } })
    suggestions.value = result.suggestions
    unplaced.value = result.unplaced
    if (!result.suggestions.length)
      toast(result.unplaced.length ? 'Nothing could be placed today' : 'Nothing left to schedule')
  }
  catch (error: any) {
    toast.error('Auto-schedule failed', { description: error?.data?.statusMessage })
  }
  finally {
    autoBusy.value = false
  }
}
async function applySuggestions() {
  let applied = 0
  for (const suggestion of [...suggestions.value]) {
    if (await schedule(suggestion.workOrderId, suggestion.technicianId, suggestion.scheduledStart))
      applied++
  }
  toast(`${applied} work order${applied === 1 ? '' : 's'} scheduled`)
}

// ── Technicians: skills and time off ──────────────────────────────────────
const isCrewOpen = ref(false)
const skillDrafts = reactive<Record<string, string>>({})
watch(isCrewOpen, (open) => {
  if (open)
    technicians.value.forEach(t => skillDrafts[t.id] = t.skills.join(', '))
})
async function saveSkills(technician: Technician) {
  try {
    await $fetch(`/api/field/technicians/${technician.id}`, { method: 'PATCH', body: { skills: (skillDrafts[technician.id] ?? '').split(',') } })
    toast(`Skills saved for ${technician.name}`)
    await load()
  }
  catch (error: any) {
    toast.error('Could not save skills', { description: error?.data?.statusMessage })
  }
}

const offForm = reactive({ technicianId: '', from: '12:00', to: '14:00', reason: 'Training' })
async function addTimeOff() {
  const [fh, fm] = offForm.from.split(':').map(Number)
  const [th, tm] = offForm.to.split(':').map(Number)
  const base = [day.value.getFullYear(), day.value.getMonth(), day.value.getDate()] as const
  try {
    await $fetch('/api/field/unavailability', { method: 'POST', body: { technicianId: offForm.technicianId, startAt: new Date(...base, fh ?? 0, fm ?? 0).toISOString(), endAt: new Date(...base, th ?? 0, tm ?? 0).toISOString(), reason: offForm.reason } })
    toast('Time off added')
    await load()
  }
  catch (error: any) {
    toast.error('Could not add time off', { description: error?.data?.statusMessage })
  }
}
async function removeTimeOff(block: TechnicianUnavailability) {
  if (!(await confirm({ title: `Remove "${block.reason ?? 'Unavailable'}"?`, description: `${clock(block.startAt)}–${clock(block.endAt)}`, confirmLabel: 'Remove' })))
    return
  await $fetch(`/api/field/unavailability/${block.id}`, { method: 'DELETE' })
  await load()
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <FieldNav />

    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="text-[13px] font-semibold text-muted-foreground">
          {{ technicians.length }} technician{{ technicians.length === 1 ? '' : 's' }} · {{ toSchedule.length }} to schedule
        </div>
        <h1 class="mt-1.5 text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[40px]">
          {{ dayTitle }}
        </h1>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex items-center gap-1 rounded-full bg-brand-fog p-1 dark:bg-muted">
          <Button variant="ghost" size="icon-sm" aria-label="Previous day" @click="shiftDay(-1)">
            <Icon name="i-lucide-chevron-left" />
          </Button>
          <Button variant="ghost" size="sm" @click="day = startOfDay(new Date())">
            Today
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next day" @click="shiftDay(1)">
            <Icon name="i-lucide-chevron-right" />
          </Button>
        </div>
        <label class="sr-only" for="board-date">Date</label>
        <Input id="board-date" v-model="dayInput" type="date" class="h-9 w-auto" />
        <Button variant="outline" @click="isCrewOpen = true">
          Technicians
        </Button>
        <Button variant="outline" as-child>
          <NuxtLink to="/field/work-orders?new=1">
            <Icon name="i-lucide-plus" /> Work order
          </NuxtLink>
        </Button>
        <Button class="bg-brand-forest text-brand-lime hover:bg-brand-spruce" :disabled="autoBusy || !toSchedule.length" @click="autoSchedule">
          <Icon name="i-lucide-sparkles" />
          {{ autoBusy ? 'Planning…' : 'Auto-schedule' }}
        </Button>
      </div>
    </div>

    <div v-if="suggestions.length || unplaced.length" role="status" class="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-mist px-4 py-3 text-sm text-brand-forest dark:bg-brand-spruce dark:text-brand-mist">
      <span>
        <b>{{ suggestions.length }} suggested slot{{ suggestions.length === 1 ? '' : 's' }}</b> shown dashed on the board.
        <template v-if="suggestions.some(s => s.lateForSla)"> Some finish after their SLA time.</template>
        <template v-if="unplaced.length"> {{ unplaced.length }} couldn't be placed: {{ unplaced.map(u => `${u.workOrderId} (${u.reason})`).join('; ') }}.</template>
      </span>
      <span class="flex gap-2">
        <Button v-if="suggestions.length" size="sm" variant="lime" @click="applySuggestions">Apply all</Button>
        <Button size="sm" variant="ghost" @click="suggestions = []; unplaced = []">Clear</Button>
      </span>
    </div>

    <div class="flex flex-wrap items-start gap-4">
      <!-- To schedule -->
      <section aria-label="Work orders to schedule" class="flex flex-[1_1_260px] flex-col gap-2.5 rounded-[28px] bg-card p-4 ring-1 ring-black/10 sm:max-w-[300px] dark:ring-white/10">
        <div class="flex items-center justify-between">
          <h2 class="m-0 text-base font-bold text-foreground">
            To schedule
          </h2>
          <span class="rounded-full bg-brand-lime px-2.5 py-0.5 text-xs font-bold text-brand-forest">{{ toSchedule.length }}</span>
        </div>
        <button
          v-for="order in toSchedule"
          :key="order.id"
          type="button"
          draggable="true"
          class="cursor-grab rounded-2xl p-3 text-left ring-1 active:cursor-grabbing"
          :class="isSlaToday(order) ? 'bg-brand-mist ring-brand-forest dark:bg-brand-spruce' : 'bg-card ring-black/10 dark:ring-white/10'"
          :aria-label="`Schedule ${order.id}: ${order.title}`"
          @dragstart="onDragStart($event, order.id)"
          @click="openScheduleDialog(order)"
        >
          <span class="block text-sm font-bold text-foreground">{{ order.id }} · {{ order.title }}</span>
          <span class="mt-1 block text-[13px] text-muted-foreground">{{ [order.clientName, durationLabel(order.durationMinutes), order.skill].filter(Boolean).join(' · ') }}</span>
          <span v-if="order.slaDueAt" class="mt-1.5 block text-xs font-bold" :class="isSlaToday(order) ? 'text-destructive' : 'text-muted-foreground'">SLA: on site by {{ new Date(order.slaDueAt).toLocaleString(undefined, { weekday: isSlaToday(order) ? undefined : 'short', hour: '2-digit', minute: '2-digit' }) }}</span>
        </button>
        <p v-if="!toSchedule.length" class="m-0 text-sm text-muted-foreground">
          Everything is scheduled.
        </p>
        <p class="m-0 text-xs text-muted-foreground">
          Drag a card onto a technician's row, or click it to pick a time.
        </p>
      </section>

      <!-- Timeline -->
      <section aria-label="Technician timeline" class="min-w-0 flex-[999_1_640px] rounded-[28px] bg-card p-4 ring-1 ring-black/10 dark:ring-white/10">
        <div class="overflow-x-auto">
          <div class="grid min-w-[860px] grid-cols-[190px_1fr] gap-y-2.5">
            <div />
            <div class="grid" :style="{ gridTemplateColumns: `repeat(${HOURS.length}, minmax(0, 1fr))` }">
              <span v-for="hour in HOURS" :key="hour" class="text-xs font-semibold text-muted-foreground">{{ String(hour).padStart(2, '0') }}:00</span>
            </div>

            <template v-for="technician in technicians" :key="technician.id">
              <div class="flex h-14 items-center gap-2.5">
                <span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-forest text-xs font-bold text-brand-lime">{{ initials(technician.name) }}</span>
                <span class="min-w-0">
                  <span class="block truncate text-sm font-semibold text-foreground">{{ technician.name }}</span>
                  <span class="block truncate text-xs text-muted-foreground">{{ technician.skills.join(', ') || 'No skills set' }} · {{ bookedPercent(technician.id) }}% booked</span>
                </span>
              </div>
              <div
                class="relative h-14 rounded-xl bg-[repeating-linear-gradient(90deg,transparent,transparent_calc(10%-1px),var(--color-border)_calc(10%-1px),var(--color-border)_10%)]"
                :aria-label="`${technician.name}'s day`"
                @dragover.prevent
                @drop.prevent="onDrop($event, technician.id)"
              >
                <button
                  v-for="block in offFor(technician.id)"
                  :key="block.id"
                  type="button"
                  class="absolute inset-y-0 overflow-hidden rounded-xl bg-[repeating-linear-gradient(45deg,var(--color-brand-fog),var(--color-brand-fog)_6px,var(--color-card)_6px,var(--color-card)_12px)] px-2 py-1.5 text-left text-xs text-muted-foreground ring-1 ring-black/10"
                  :style="place(block.startAt, (new Date(block.endAt).getTime() - new Date(block.startAt).getTime()) / 60000)"
                  :title="`${block.reason ?? 'Unavailable'} — click to remove`"
                  @click="removeTimeOff(block)"
                >
                  {{ block.reason ?? 'Unavailable' }}
                </button>
                <NuxtLink
                  v-for="order in scheduledFor(technician.id)"
                  :key="order.id"
                  :to="`/field/work-orders/${order.id}`"
                  draggable="true"
                  class="absolute inset-y-0 overflow-hidden rounded-xl px-2.5 py-1.5 text-[13px] leading-tight"
                  :class="BLOCK_CLASS[order.status] ?? BLOCK_CLASS.scheduled"
                  :style="place(order.scheduledStart!, order.durationMinutes)"
                  :title="`${order.id} · ${order.title} · ${clock(order.scheduledStart!)}`"
                  @dragstart="onDragStart($event, order.id)"
                >
                  <b :class="order.status === 'scheduled' || order.status === 'completed' ? 'text-brand-lime' : ''">{{ order.id }}</b>
                  <Icon v-if="order.status === 'completed'" name="i-lucide-check" class="ml-1 size-3.5 align-[-2px]" />
                  {{ order.title }}<template v-if="order.clientName">
                    · {{ order.clientName }}
                  </template>
                </NuxtLink>
                <button
                  v-for="suggestion in suggestionsFor(technician.id)"
                  :key="suggestion.workOrderId"
                  type="button"
                  class="absolute inset-y-0 overflow-hidden rounded-xl border-2 border-dashed border-brand-forest bg-brand-mist px-2.5 py-1.5 text-left text-[13px] leading-tight text-brand-forest"
                  :style="place(suggestion.scheduledStart, orderById(suggestion.workOrderId)?.durationMinutes ?? 60)"
                  :title="`Apply: ${suggestion.workOrderId} at ${clock(suggestion.scheduledStart)}`"
                  @click="schedule(suggestion.workOrderId, suggestion.technicianId, suggestion.scheduledStart)"
                >
                  <b>Suggested:</b> {{ suggestion.workOrderId }}<template v-if="suggestion.lateForSla">
                    · after SLA
                  </template>
                </button>
              </div>
            </template>
          </div>
          <p v-if="!technicians.length" class="m-0 p-6 text-center text-sm text-muted-foreground">
            No technicians yet. Give staff the Engineer, Engineering coordinator or Engineering lead role (Admin → Staff) and they appear here.
          </p>
        </div>
        <div class="mt-4 flex flex-wrap gap-4 text-[13px]">
          <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded bg-brand-forest" />Scheduled</span>
          <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded bg-brand-lime" />Travelling / on site</span>
          <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded bg-brand-spruce" />Completed</span>
          <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3.5 rounded border-2 border-dashed border-brand-forest" />Auto-schedule suggestion</span>
        </div>
      </section>
    </div>

    <!-- Schedule dialog -->
    <Dialog :open="!!dialogOrder" @update:open="(open) => !open && (dialogOrder = null)">
      <DialogContent v-if="dialogOrder">
        <DialogHeader>
          <DialogTitle>Schedule {{ dialogOrder.id }}</DialogTitle>
          <DialogDescription>
            {{ dialogOrder.title }} · {{ durationLabel(dialogOrder.durationMinutes) }}<template v-if="dialogOrder.skill">
              · needs {{ dialogOrder.skill }}
            </template>
          </DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="saveDialog">
          <div class="flex flex-col gap-1.5">
            <Label for="schedule-tech">Technician</Label>
            <Select v-model="dialogTechnician">
              <SelectTrigger id="schedule-tech" class="w-full">
                <SelectValue placeholder="Choose a technician" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="technician in technicians" :key="technician.id" :value="technician.id">
                  {{ technician.name }}{{ technician.skills.length ? ` · ${technician.skills.join(', ')}` : '' }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="schedule-time">Start on {{ dayTitle }}</Label>
            <Input id="schedule-time" v-model="dialogTime" type="time" step="900" />
          </div>
          <DialogFooter class="gap-2">
            <Button v-if="dialogOrder.technicianId" type="button" variant="ghost" @click="unscheduleDialog">
              Unschedule
            </Button>
            <Button type="button" variant="outline" as-child>
              <NuxtLink :to="`/field/work-orders/${dialogOrder.id}`">
                Open
              </NuxtLink>
            </Button>
            <Button type="submit" :disabled="!dialogTechnician">
              Schedule
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <!-- Technicians -->
    <Sheet v-model:open="isCrewOpen">
      <SheetContent side="right" class="w-full overflow-y-auto p-6 sm:max-w-lg">
        <SheetHeader class="p-0">
          <SheetTitle>Technicians</SheetTitle>
          <SheetDescription>Skills are matched against each work order's required skill when you auto-schedule.</SheetDescription>
        </SheetHeader>
        <div class="mt-4 flex flex-col gap-3">
          <form v-for="technician in technicians" :key="technician.id" class="flex flex-col gap-1.5 rounded-2xl border p-3" @submit.prevent="saveSkills(technician)">
            <Label :for="`skills-${technician.id}`">{{ technician.name }}</Label>
            <div class="flex gap-2">
              <Input :id="`skills-${technician.id}`" v-model="skillDrafts[technician.id]" placeholder="e.g. HVAC, Access control" />
              <Button type="submit" size="sm" variant="outline">
                Save
              </Button>
            </div>
          </form>
        </div>
        <form class="mt-6 flex flex-col gap-3 rounded-2xl bg-muted/50 p-4" @submit.prevent="addTimeOff">
          <h3 class="m-0 text-sm font-bold">
            Time off on {{ dayTitle }}
          </h3>
          <Select v-model="offForm.technicianId">
            <SelectTrigger class="w-full" aria-label="Technician">
              <SelectValue placeholder="Technician" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="technician in technicians" :key="technician.id" :value="technician.id">
                {{ technician.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="grid grid-cols-2 gap-2">
            <Input v-model="offForm.from" type="time" aria-label="From" />
            <Input v-model="offForm.to" type="time" aria-label="To" />
          </div>
          <Input v-model="offForm.reason" placeholder="Reason (e.g. Training)" aria-label="Reason" />
          <Button type="submit" :disabled="!offForm.technicianId">
            Add time off
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  </div>
</template>
