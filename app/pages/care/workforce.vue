<script setup lang="ts">
import type { CareShift } from '~/types/care'
import { toast } from 'vue-sonner'
import { CARE_MODELS } from '~/types/care'

// "Canopy Care — workforce planning" in the Canopy design.
definePageMeta({ middleware: 'platform' })

interface Workforce {
  date: string
  hours: { hour: number, needed: number, scheduled: number, contacts: number }[]
  shifts: CareShift[]
  clients: { orgId: string, orgName: string, model: string, waiting: number, serviceLevel: number | null, targetSeconds: number }[]
  floor: { agents: number, online: number, away: number }
  agents: { id: string, name: string }[]
}

const date = ref(new Date().toISOString().slice(0, 10))
const data = ref<Workforce | null>(null)
async function load() {
  data.value = await fetchUntyped<Workforce>('/api/care/workforce', { query: { date: date.value } })
}
onMounted(load)
watch(date, load)

// Show the working day (07:00–21:00 GMT) unless there's demand outside it.
const visibleHours = computed(() => {
  const hours = data.value?.hours ?? []
  const busy = hours.filter(h => h.needed || h.scheduled)
  const first = Math.min(7, ...busy.map(h => h.hour))
  const last = Math.max(20, ...busy.map(h => h.hour))
  return hours.filter(h => h.hour >= first && h.hour <= last)
})
const peak = computed(() => Math.max(1, ...visibleHours.value.flatMap(h => [h.needed, h.scheduled])))
const shortfalls = computed(() => visibleHours.value.filter(h => h.needed > h.scheduled))
const shortfallLine = computed(() => {
  const gaps = shortfalls.value
  if (!gaps.length)
    return null
  const worst = gaps.reduce((a, b) => (b.needed - b.scheduled > a.needed - a.scheduled ? b : a))
  return `Short by ${worst.needed - worst.scheduled} agent${worst.needed - worst.scheduled === 1 ? '' : 's'} at ${String(worst.hour).padStart(2, '0')}:00 (${gaps.length} hour${gaps.length === 1 ? '' : 's'} under-staffed).`
})

const shift = reactive({ staffId: '', startHour: 8, endHour: 16 })
async function addShift() {
  try {
    await fetchUntyped('/api/care/shifts', { method: 'POST', body: { ...shift, date: date.value } })
    toast('Shift added')
    await load()
  }
  catch (e: any) {
    toast.error('Not added', { description: e?.data?.statusMessage })
  }
}
async function removeShift(id: string) {
  await fetchUntyped(`/api/care/shifts/${id}`, { method: 'DELETE' })
  await load()
}
const modelLabel = (m: string) => CARE_MODELS.find(x => x.value === m)?.label ?? m
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <CareNav />
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="text-[13px] font-semibold text-muted-foreground">
          All Care clients · times in GMT
        </div>
        <h1 class="m-0 mt-1.5 text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
          Staffing vs. demand
        </h1>
      </div>
      <Input v-model="date" type="date" class="w-auto" aria-label="Date" />
    </div>

    <div v-if="data" class="flex flex-wrap items-start gap-4">
      <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
        <RecordCard title="Agents needed (forecast) vs. scheduled, by hour">
          <template #actions>
            <span class="flex gap-3 text-xs">
              <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3 rounded bg-brand-mist ring-1 ring-brand-forest" />Needed</span>
              <span class="flex items-center gap-1.5"><span aria-hidden="true" class="size-3 rounded bg-brand-forest dark:bg-brand-lime" />Scheduled</span>
            </span>
          </template>
          <div class="flex h-[180px] items-end gap-1.5 border-b border-border pb-1">
            <div v-for="h in visibleHours" :key="h.hour" class="flex h-full flex-1 items-end justify-center gap-0.5" :title="`${h.hour}:00 — needed ${h.needed}, scheduled ${h.scheduled} (${h.contacts} contacts expected)`">
              <div class="w-1/2 rounded-t-md bg-brand-mist ring-1 ring-brand-forest" :style="{ height: `${(h.needed / peak) * 100}%` }" />
              <div class="w-1/2 rounded-t-md" :class="h.scheduled < h.needed ? 'bg-destructive' : 'bg-brand-forest dark:bg-brand-lime'" :style="{ height: `${(h.scheduled / peak) * 100}%` }" />
            </div>
          </div>
          <div class="flex gap-1.5 text-center text-[11px] text-muted-foreground">
            <span v-for="h in visibleHours" :key="h.hour" class="flex-1">{{ String(h.hour).padStart(2, '0') }}</span>
          </div>
          <p class="m-0 rounded-xl px-3.5 py-2.5 text-sm font-semibold" :class="shortfallLine ? 'bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200' : 'bg-brand-mist text-brand-forest'">
            {{ shortfallLine ?? 'Covered all day.' }}
          </p>
          <p class="m-0 text-xs text-muted-foreground">
            Forecast: average contacts on this weekday over the last 4 weeks × handle time, with 30% shrinkage.
          </p>
        </RecordCard>

        <RecordCard title="Service level now, by client">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead><TableHead>Model</TableHead><TableHead class="text-right">
                  Waiting
                </TableHead><TableHead class="text-right">
                  Service level today
                </TableHead><TableHead class="text-right">
                  Target
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="client in data.clients" :key="client.orgId">
                <TableCell class="font-semibold">
                  {{ client.orgName }}
                </TableCell>
                <TableCell class="text-muted-foreground">
                  {{ modelLabel(client.model) }}
                </TableCell>
                <TableCell class="text-right tabular-nums" :class="client.waiting > 5 ? 'font-bold text-destructive' : ''">
                  {{ client.waiting }}
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ client.serviceLevel === null ? '—' : `${client.serviceLevel}%` }}
                </TableCell>
                <TableCell class="text-right text-muted-foreground">
                  reply ≤ {{ client.targetSeconds < 120 ? `${client.targetSeconds}s` : `${Math.round(client.targetSeconds / 60)} min` }}
                </TableCell>
              </TableRow>
              <TableRow v-if="!data.clients.length">
                <TableCell :colspan="5" class="h-16 text-center text-muted-foreground">
                  No clients in pilot or live.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </RecordCard>
      </div>

      <aside class="flex flex-[1_1_300px] flex-col gap-4 lg:max-w-[380px]">
        <RecordCard title="Floor right now" tone="forest">
          <dl class="m-0 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt class="text-brand-mist">
                Care agents
              </dt><dd class="m-0 text-2xl font-black text-brand-lime">
                {{ data.floor.agents }}
              </dd>
            </div>
            <div>
              <dt class="text-brand-mist">
                Online
              </dt><dd class="m-0 text-2xl font-black text-brand-lime">
                {{ data.floor.online }}
              </dd>
            </div>
            <div>
              <dt class="text-brand-mist">
                Away
              </dt><dd class="m-0 text-2xl font-black text-brand-lime">
                {{ data.floor.away }}
              </dd>
            </div>
          </dl>
        </RecordCard>

        <RecordCard title="Rota">
          <div v-for="item in data.shifts" :key="item.id" class="flex items-center justify-between text-sm">
            <span><b>{{ item.staffName }}</b> · {{ String(item.startHour).padStart(2, '0') }}:00–{{ String(item.endHour).padStart(2, '0') }}:00</span>
            <Button variant="ghost" size="icon-sm" :aria-label="`Remove ${item.staffName}'s shift`" @click="removeShift(item.id)">
              <Icon name="i-lucide-x" />
            </Button>
          </div>
          <p v-if="!data.shifts.length" class="m-0 text-sm text-muted-foreground">
            Nobody on the rota for this day.
          </p>
          <form class="flex flex-col gap-2 rounded-2xl bg-muted/50 p-3" @submit.prevent="addShift">
            <Select v-model="shift.staffId">
              <SelectTrigger class="w-full" aria-label="Agent">
                <SelectValue :placeholder="data.agents.length ? 'Agent' : 'Assign Care agents to an engagement first'" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="agent in data.agents" :key="agent.id" :value="agent.id">
                  {{ agent.name }}
                </SelectItem>
              </SelectContent>
            </Select>
            <div class="grid grid-cols-2 gap-2">
              <Input v-model.number="shift.startHour" type="number" min="0" max="23" aria-label="Start hour" />
              <Input v-model.number="shift.endHour" type="number" min="1" max="24" aria-label="End hour" />
            </div>
            <Button type="submit" :disabled="!shift.staffId">
              Add shift
            </Button>
          </form>
        </RecordCard>
      </aside>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      Loading…
    </p>
  </div>
</template>
