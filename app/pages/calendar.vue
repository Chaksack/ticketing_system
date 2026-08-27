<script setup lang="ts">
import type { CalendarEvent } from '~/types/calendar-event'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'

const { currentUser } = useAuth()
const { staff, fetchStaff } = useStaff()
const { events, fetchEvents, addEvent, updateEvent, removeEvent } = useCalendar()
const route = useRoute()

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

const viewMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

const monthLabel = computed(() => viewMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))

const gridDays = computed(() => {
  const start = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth(), 1)
  const startWeekday = start.getDay()
  const gridStart = new Date(start)
  gridStart.setDate(start.getDate() - startWeekday)

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const day = new Date(gridStart)
    day.setDate(gridStart.getDate() + i)
    days.push(day)
  }
  return days
})

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

const eventsByDay = computed(() => {
  const map = new Map<string, CalendarEvent[]>()
  for (const event of events.value) {
    const key = new Date(event.startAt).toISOString().slice(0, 10)
    const list = map.get(key) ?? []
    list.push(event)
    map.set(key, list)
  }
  return map
})

async function refreshEvents() {
  const from = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() - 1, 1).toISOString()
  const to = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + 2, 0).toISOString()
  await fetchEvents({ from, to })
}

onMounted(async () => {
  if (!staff.value.length)
    await fetchStaff()
  await refreshEvents()

  const openId = typeof route.query.event === 'string' ? route.query.event : null
  if (openId) {
    const event = events.value.find(e => e.id === openId)
    if (event)
      openDetail(event)
  }
})

function goToMonth(delta: number) {
  viewMonth.value = new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + delta, 1)
  refreshEvents()
}

function goToday() {
  viewMonth.value = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  refreshEvents()
}

const df = new DateFormatter('en-US', { dateStyle: 'medium' })
const startField = useDateTimeField()
const endField = useDateTimeField()

const isDetailOpen = ref(false)
const selectedEvent = ref<CalendarEvent | null>(null)

const isFormOpen = ref(false)
const isEditing = ref(false)
const editingId = ref<string | null>(null)
const formTitle = ref('')
const formDescription = ref('')
const formLocation = ref('')
const formAttendeeIds = ref<string[]>([])

function openCreateForm(date?: Date) {
  isEditing.value = false
  editingId.value = null
  formTitle.value = ''
  formDescription.value = ''
  formLocation.value = ''
  formAttendeeIds.value = currentUser.value ? [currentUser.value.id] : []

  const base = date ?? new Date()
  const start = new Date(base)
  start.setHours(9, 0, 0, 0)
  const end = new Date(start)
  end.setHours(start.getHours() + 1)

  startField.setFromIso(start.toISOString())
  endField.setFromIso(end.toISOString())
  isFormOpen.value = true
}

function openEditForm(event: CalendarEvent) {
  isEditing.value = true
  editingId.value = event.id
  formTitle.value = event.title
  formDescription.value = event.description ?? ''
  formLocation.value = event.location ?? ''
  formAttendeeIds.value = event.attendees.map(a => a.id)
  startField.setFromIso(event.startAt)
  endField.setFromIso(event.endAt)
  isFormOpen.value = true
  isDetailOpen.value = false
}

async function onSubmitForm() {
  const startAt = startField.toIso()
  const endAt = endField.toIso()

  if (!formTitle.value.trim() || !startAt || !endAt)
    return

  try {
    if (isEditing.value && editingId.value) {
      await updateEvent(editingId.value, {
        title: formTitle.value.trim(),
        description: formDescription.value || undefined,
        location: formLocation.value || undefined,
        startAt,
        endAt,
        attendeeIds: formAttendeeIds.value,
      })
      toast('Meeting updated')
    }
    else {
      await addEvent({
        title: formTitle.value.trim(),
        description: formDescription.value || undefined,
        location: formLocation.value || undefined,
        startAt,
        endAt,
        attendeeIds: formAttendeeIds.value,
      })
      toast('Meeting scheduled')
    }
    isFormOpen.value = false
  }
  catch (error: any) {
    toast.error('Could not save meeting', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

function openDetail(event: CalendarEvent) {
  selectedEvent.value = event
  isDetailOpen.value = true
}

async function onDeleteEvent() {
  if (!selectedEvent.value)
    return

  await removeEvent(selectedEvent.value.id)
  isDetailOpen.value = false
  toast('Meeting deleted')
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatRange(event: CalendarEvent) {
  return `${df.format(new Date(event.startAt))} · ${formatTime(event.startAt)} – ${formatTime(event.endAt)}`
}

const today = new Date()
function isToday(date: Date) {
  return date.toDateString() === today.toDateString()
}
function isCurrentMonth(date: Date) {
  return date.getMonth() === viewMonth.value.getMonth()
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Calendar
        </h2>
        <p class="text-muted-foreground">
          Team meetings and events.
        </p>
      </div>
      <Button @click="openCreateForm()">
        <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
        New Meeting
      </Button>
    </div>

    <div class="flex items-center justify-between gap-2">
      <div class="flex items-center gap-1">
        <Button size="icon-sm" variant="outline" @click="goToMonth(-1)">
          <Icon name="i-lucide-chevron-left" class="size-4" />
        </Button>
        <Button size="sm" variant="outline" @click="goToday">
          Today
        </Button>
        <Button size="icon-sm" variant="outline" @click="goToMonth(1)">
          <Icon name="i-lucide-chevron-right" class="size-4" />
        </Button>
      </div>
      <span class="font-medium">{{ monthLabel }}</span>
    </div>

    <div class="grid grid-cols-7 border rounded-md overflow-hidden">
      <div v-for="dayName in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']" :key="dayName" class="border-b bg-muted/50 px-2 py-1.5 text-xs font-medium text-muted-foreground text-center">
        {{ dayName }}
      </div>
      <div
        v-for="date in gridDays"
        :key="date.toISOString()"
        class="min-h-28 border-b border-r p-1.5 flex flex-col gap-1 cursor-pointer hover:bg-accent/40"
        :class="{ 'bg-muted/30': !isCurrentMonth(date) }"
        @click="openCreateForm(date)"
      >
        <span class="text-xs" :class="isToday(date) ? 'font-bold text-primary' : 'text-muted-foreground'">
          {{ date.getDate() }}
        </span>
        <div class="flex flex-col gap-0.5">
          <button
            v-for="event in (eventsByDay.get(dayKey(date)) ?? []).slice(0, 3)"
            :key="event.id"
            type="button"
            class="truncate rounded bg-primary/10 px-1 py-0.5 text-left text-[11px] font-medium text-primary hover:bg-primary/20"
            @click.stop="openDetail(event)"
          >
            {{ formatTime(event.startAt) }} {{ event.title }}
          </button>
          <span v-if="(eventsByDay.get(dayKey(date))?.length ?? 0) > 3" class="text-[10px] text-muted-foreground px-1">
            +{{ (eventsByDay.get(dayKey(date))?.length ?? 0) - 3 }} more
          </span>
        </div>
      </div>
    </div>

    <Sheet v-model:open="isFormOpen">
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader class="p-0">
          <SheetTitle>{{ isEditing ? 'Edit Meeting' : 'New Meeting' }}</SheetTitle>
        </SheetHeader>
        <div class="flex flex-col gap-4 pt-4">
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Title</Label>
            <Input v-model="formTitle" placeholder="e.g. Client kickoff call" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Description</Label>
            <Textarea v-model="formDescription" rows="3" placeholder="Optional agenda or notes" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Location / Link</Label>
            <Input v-model="formLocation" placeholder="Meeting room, or a video call link" />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Starts</Label>
              <div class="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button variant="outline" size="sm" class="flex-1 justify-start text-left font-normal">
                      <Icon name="i-lucide-calendar" class="mr-1.5 h-3.5 w-3.5" />
                      {{ startField.date.value ? df.format(startField.date.value.toDate(getLocalTimeZone())) : 'Pick date' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0">
                    <Calendar v-model="startField.date.value" initial-focus />
                  </PopoverContent>
                </Popover>
                <Input v-model="startField.time.value" type="time" step="60" class="w-24 h-8 text-xs" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Ends</Label>
              <div class="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button variant="outline" size="sm" class="flex-1 justify-start text-left font-normal">
                      <Icon name="i-lucide-calendar" class="mr-1.5 h-3.5 w-3.5" />
                      {{ endField.date.value ? df.format(endField.date.value.toDate(getLocalTimeZone())) : 'Pick date' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0">
                    <Calendar v-model="endField.date.value" initial-focus />
                  </PopoverContent>
                </Popover>
                <Input v-model="endField.time.value" type="time" step="60" class="w-24 h-8 text-xs" />
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <Label class="text-xs text-muted-foreground">Attendees</Label>
            <StaffAssigneePicker v-model="formAttendeeIds" :staff="activeStaff" />
          </div>

          <SheetFooter class="p-0">
            <Button :disabled="!formTitle.trim()" @click="onSubmitForm">
              {{ isEditing ? 'Save Changes' : 'Schedule Meeting' }}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>

    <Sheet v-model:open="isDetailOpen">
      <SheetContent side="right" class="w-full sm:max-w-md p-6">
        <template v-if="selectedEvent">
          <SheetHeader class="p-0">
            <SheetTitle>{{ selectedEvent.title }}</SheetTitle>
            <SheetDescription>{{ formatRange(selectedEvent) }}</SheetDescription>
          </SheetHeader>
          <div class="flex flex-col gap-4 pt-4">
            <p v-if="selectedEvent.location" class="text-sm flex items-center gap-1.5">
              <Icon name="i-lucide-map-pin" class="size-3.5 text-muted-foreground" />
              {{ selectedEvent.location }}
            </p>
            <p v-if="selectedEvent.description" class="text-sm text-muted-foreground whitespace-pre-wrap">
              {{ selectedEvent.description }}
            </p>
            <div class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Attendees</Label>
              <div class="flex flex-wrap gap-1">
                <Badge v-for="attendee in selectedEvent.attendees" :key="attendee.id" variant="outline">
                  {{ attendee.name }}
                </Badge>
              </div>
            </div>
            <Separator />
            <div class="flex items-center gap-2">
              <Button size="sm" variant="outline" @click="openEditForm(selectedEvent)">
                Edit
              </Button>
              <Button size="sm" variant="ghost" class="text-destructive" @click="onDeleteEvent">
                Delete
              </Button>
            </div>
          </div>
        </template>
      </SheetContent>
    </Sheet>
  </div>
</template>
