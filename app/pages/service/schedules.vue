<script setup lang="ts">
import type { SupportAgent, SupportShift } from '~/types/supportDesk'
import { toast } from 'vue-sonner'

// Support setup → Team schedules: the weekly rota for the support desk. Shows who's on shift now
// and where days are uncovered.
definePageMeta({ middleware: 'agent' })

const { isAdmin } = useAuth()
const shifts = ref<SupportShift[]>([])
const agents = ref<SupportAgent[]>([])
const timeZone = ref('')
const now = ref<{ weekday: number, time: string } | null>(null)
const loaded = ref(false)

async function load() {
  const [rota, people] = await Promise.all([
    fetchUntyped<{ shifts: SupportShift[], timeZone: string, now: { weekday: number, time: string } }>('/api/service/shifts'),
    fetchUntyped<{ agents: SupportAgent[] }>('/api/service/agents'),
  ])
  shifts.value = rota.shifts
  timeZone.value = rota.timeZone
  now.value = rota.now
  agents.value = people.agents
  loaded.value = true
}
onMounted(load)

// Monday first, like a work week.
const DAYS = [1, 2, 3, 4, 5, 6, 0].map(day => ({ day, label: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]! }))
const shiftsFor = (staffId: string, day: number) => shifts.value.filter(s => s.staffId === staffId && s.weekday === day)
const coverage = (day: number) => new Set(shifts.value.filter(s => s.weekday === day).map(s => s.staffId)).size

// ── Add shift ───────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const form = reactive({ staffId: '', weekdays: [1, 2, 3, 4, 5] as number[], startTime: '08:00', endTime: '16:00' })
function openAdd(staffId = '', day?: number) {
  Object.assign(form, { staffId, weekdays: day === undefined ? [1, 2, 3, 4, 5] : [day], startTime: '08:00', endTime: '16:00' })
  dialogOpen.value = true
}
function toggleDay(day: number) {
  form.weekdays = form.weekdays.includes(day) ? form.weekdays.filter(d => d !== day) : [...form.weekdays, day]
}
async function addShift() {
  try {
    shifts.value = (await fetchUntyped<{ shifts: SupportShift[] }>('/api/service/shifts', { method: 'POST', body: form })).shifts
    dialogOpen.value = false
    toast('Shift added')
  }
  catch (error: any) {
    toast.error('Not added', { description: error?.data?.statusMessage })
  }
}
async function removeShift(shift: SupportShift) {
  try {
    shifts.value = (await fetchUntyped<{ shifts: SupportShift[] }>(`/api/service/shifts/${shift.id}`, { method: 'DELETE' })).shifts
  }
  catch (error: any) {
    toast.error('Not removed', { description: error?.data?.statusMessage })
  }
}
const isNow = (shift: SupportShift) => !!now.value && shift.weekday === now.value.weekday && shift.startTime <= now.value.time && now.value.time < shift.endTime
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="Schedule actions">
      <Button v-if="isAdmin" variant="lime" @click="openAdd()">
        <Icon name="i-lucide-plus" />
        Add shift
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/service/agents">
          <Icon name="i-lucide-users-round" />
          Support agents
        </NuxtLink>
      </Button>
    </PageActions>

    <PageTitle title="Team schedules" :description="`The weekly support rota${timeZone ? ` (times in ${timeZone})` : ''}. Shifts on now are highlighted.`" />

    <div class="overflow-x-auto rounded-[28px] bg-card p-3 ring-1 ring-black/10 sm:p-5 dark:ring-white/10">
      <table class="w-full min-w-[860px] border-separate border-spacing-1 text-sm">
        <thead>
          <tr>
            <th scope="col" class="w-48 px-2 py-2 text-left text-[13px] font-semibold">
              Agent
            </th>
            <th v-for="day in DAYS" :key="day.day" scope="col" class="px-2 py-2 text-left text-[13px] font-semibold" :class="now?.weekday === day.day ? 'text-primary dark:text-brand-lime' : ''">
              {{ day.label }}<span v-if="now?.weekday === day.day" class="ml-1 text-xs font-normal">today</span>
              <span class="block text-xs font-normal" :class="coverage(day.day) ? 'text-muted-foreground' : 'text-destructive'">{{ coverage(day.day) ? `${coverage(day.day)} on` : 'No cover' }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="agent in agents" :key="agent.id">
            <th scope="row" class="px-2 py-2 text-left align-top font-semibold text-foreground">
              {{ agent.name }}
            </th>
            <td v-for="day in DAYS" :key="day.day" class="h-14 rounded-xl px-1.5 py-1.5 align-top" :class="now?.weekday === day.day ? 'bg-brand-mist/50 dark:bg-brand-spruce/40' : 'bg-muted/40'">
              <div class="flex flex-col gap-1">
                <span v-for="shift in shiftsFor(agent.id, day.day)" :key="shift.id" class="group flex items-center justify-between gap-1 rounded-lg px-2 py-1 text-xs font-semibold" :class="isNow(shift) ? 'bg-brand-forest text-brand-lime' : 'bg-card text-foreground ring-1 ring-black/10 dark:ring-white/10'">
                  {{ shift.startTime }}–{{ shift.endTime }}
                  <button v-if="isAdmin" type="button" class="opacity-60 hover:opacity-100" :aria-label="`Remove ${agent.name}'s ${day.label} shift ${shift.startTime} to ${shift.endTime}`" @click="removeShift(shift)">
                    <Icon name="i-lucide-x" class="size-3" />
                  </button>
                </span>
                <button v-if="isAdmin && !shiftsFor(agent.id, day.day).length" type="button" class="rounded-lg py-1 text-xs text-muted-foreground hover:bg-card hover:text-foreground" :aria-label="`Add a ${day.label} shift for ${agent.name}`" @click="openAdd(agent.id, day.day)">
                  + Add
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="loaded && !agents.length">
            <td :colspan="8" class="py-10 text-center text-muted-foreground">
              No support agents yet.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add shift</DialogTitle>
          <DialogDescription>Times in {{ timeZone }}.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="addShift">
          <div class="flex flex-col gap-1.5">
            <Label for="shift-agent">Agent</Label>
            <Select v-model="form.staffId">
              <SelectTrigger id="shift-agent">
                <SelectValue placeholder="Choose someone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="agent in agents" :key="agent.id" :value="agent.id">
                  {{ agent.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-medium">Days</span>
            <div class="flex flex-wrap gap-1.5">
              <button v-for="day in DAYS" :key="day.day" type="button" class="min-w-11 rounded-full px-2.5 py-1.5 text-xs font-semibold" :class="form.weekdays.includes(day.day) ? 'bg-brand-forest text-brand-lime' : 'bg-muted text-muted-foreground'" :aria-pressed="form.weekdays.includes(day.day)" @click="toggleDay(day.day)">
                {{ day.label }}
              </button>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="shift-start">Starts</Label>
              <Input id="shift-start" v-model="form.startTime" type="time" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="shift-end">Ends</Label>
              <Input id="shift-end" v-model="form.endTime" type="time" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" @click="dialogOpen = false">
              Cancel
            </Button>
            <Button type="submit" variant="lime" :disabled="!form.staffId || !form.weekdays.length">
              Add shift
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
