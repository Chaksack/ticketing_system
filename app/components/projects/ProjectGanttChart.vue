<script setup lang="ts">
import type { Task } from '~/types/task'

const props = defineProps<{
  tasks: Task[]
}>()

const emit = defineEmits<{
  (e: 'select', task: Task): void
}>()

const { statuses, fetchStatuses } = useTaskStatuses()

onMounted(() => {
  if (!statuses.value.length)
    fetchStatuses()
})

// Status columns are a shared, board-configurable set (not a fixed enum), so bars are colored by
// a heuristic — first/last column read as "not started"/"done", anything else as "in progress" —
// the same convention SprintBoard.vue already uses for its own todo/done lookups.
const doneStatusId = computed(() => statuses.value.find(s => s.id === 'done')?.id ?? statuses.value.at(-1)?.id)
const todoStatusId = computed(() => statuses.value.find(s => s.id === 'todo')?.id ?? statuses.value[0]?.id)

function statusLabel(task: Task) {
  return statuses.value.find(s => s.id === task.status)?.label ?? task.status
}

function barClass(task: Task) {
  if (task.status === doneStatusId.value)
    return 'bg-emerald-500'
  if (task.status === todoStatusId.value)
    return 'bg-muted-foreground/50'
  return 'bg-primary'
}

interface ScheduledTask {
  task: Task
  startMs: number
  endMs: number
}

const workItems = computed(() => props.tasks.filter(t => t.type !== 'epic'))

const scheduled = computed<ScheduledTask[]>(() => {
  const items: ScheduledTask[] = []
  for (const task of workItems.value) {
    const start = task.startDate ?? task.dueDate
    const end = task.dueDate ?? task.startDate
    if (!start || !end)
      continue
    const startMs = new Date(start).getTime()
    const endMs = new Date(end).getTime()
    items.push({ task, startMs, endMs: Math.max(endMs, startMs) })
  }
  return items
})

const unscheduled = computed(() => workItems.value.filter(t => !t.startDate && !t.dueDate))

const DAY_MS = 24 * 60 * 60 * 1000

const range = computed(() => {
  if (!scheduled.value.length) {
    const now = Date.now()
    return { start: now - 7 * DAY_MS, end: now + 21 * DAY_MS }
  }
  const starts = scheduled.value.map(s => s.startMs)
  const ends = scheduled.value.map(s => s.endMs)
  return { start: Math.min(...starts) - DAY_MS, end: Math.max(...ends) + DAY_MS }
})

const totalMs = computed(() => Math.max(range.value.end - range.value.start, DAY_MS))

function leftPct(ms: number) {
  return ((ms - range.value.start) / totalMs.value) * 100
}

function barStyle(item: ScheduledTask) {
  const left = leftPct(item.startMs)
  const width = Math.max(leftPct(item.endMs) - left, 2)
  return { left: `${left}%`, width: `${width}%` }
}

const ticks = computed(() => {
  const totalDays = totalMs.value / DAY_MS
  const stepDays = totalDays <= 21 ? 1 : totalDays <= 90 ? 7 : 30
  const stepMs = stepDays * DAY_MS
  const result: { ms: number, label: string }[] = []
  let cursor = Math.ceil(range.value.start / stepMs) * stepMs
  while (cursor <= range.value.end) {
    result.push({ ms: cursor, label: new Date(cursor).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) })
    cursor += stepMs
  }
  return result
})

const now = Date.now()
const showTodayLine = computed(() => now >= range.value.start && now <= range.value.end)
const todayLeftPct = computed(() => leftPct(now))

interface EpicGroup {
  key: string
  title: string
  color?: string
  items: ScheduledTask[]
}

const groups = computed<EpicGroup[]>(() => {
  const byEpic = new Map<string, EpicGroup>()
  const noEpic: EpicGroup = { key: 'none', title: 'No Epic', items: [] }

  for (const item of scheduled.value) {
    if (!item.task.epicId) {
      noEpic.items.push(item)
      continue
    }
    let group = byEpic.get(item.task.epicId)
    if (!group) {
      group = { key: item.task.epicId, title: item.task.epicTitle ?? 'Epic', color: item.task.epicColor, items: [] }
      byEpic.set(item.task.epicId, group)
    }
    group.items.push(item)
  }

  const result = [...byEpic.values()]
  if (noEpic.items.length)
    result.push(noEpic)
  return result
})

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div v-if="scheduled.length" class="overflow-x-auto rounded-md border">
      <div class="min-w-[720px]">
        <div class="relative flex h-8 items-center border-b bg-muted/30 text-xs text-muted-foreground">
          <span
            v-for="tick in ticks"
            :key="tick.ms"
            class="absolute -translate-x-1/2 whitespace-nowrap"
            :style="{ left: `${leftPct(tick.ms)}%` }"
          >
            {{ tick.label }}
          </span>
        </div>

        <div class="relative">
          <div
            v-if="showTodayLine"
            class="absolute top-0 bottom-0 z-10 w-px bg-destructive/70"
            :style="{ left: `${todayLeftPct}%` }"
          >
            <span class="absolute -top-0 left-1 text-[10px] font-medium text-destructive">Today</span>
          </div>

          <template v-for="group in groups" :key="group.key">
            <div class="flex items-center gap-1.5 border-b bg-muted/20 px-2 py-1">
              <span v-if="group.color" class="size-2 rounded-full" :style="{ backgroundColor: group.color }" />
              <span class="text-xs font-medium">{{ group.title }}</span>
            </div>
            <div
              v-for="item in group.items"
              :key="item.task.id"
              class="relative h-10 border-b last:border-b-0"
            >
              <button
                type="button"
                class="absolute top-1.5 h-7 truncate rounded-md px-2 text-left text-[11px] font-medium text-white shadow-sm transition-opacity hover:opacity-90"
                :class="barClass(item.task)"
                :style="barStyle(item)"
                :title="`${item.task.title} · ${statusLabel(item.task)} · ${formatDate(item.startMs)} – ${formatDate(item.endMs)}`"
                @click="emit('select', item.task)"
              >
                {{ item.task.title }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-muted-foreground">
      No tasks with dates yet — set a start or due date on a task to see it here.
    </p>

    <div v-if="unscheduled.length" class="flex flex-col gap-2">
      <h4 class="text-sm font-medium">
        Unscheduled
      </h4>
      <button
        v-for="task in unscheduled"
        :key="task.id"
        type="button"
        class="flex items-center justify-between rounded-md border p-2 text-left text-sm hover:bg-accent/50"
        @click="emit('select', task)"
      >
        <span class="truncate">{{ task.title }}</span>
        <Badge variant="outline" class="shrink-0 text-[10px]">
          {{ statusLabel(task) }}
        </Badge>
      </button>
    </div>
  </div>
</template>
