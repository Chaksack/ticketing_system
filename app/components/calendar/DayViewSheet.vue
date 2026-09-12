<script setup lang="ts">
import type { CalendarEvent } from '~/types/calendar-event'
import { activityTypeBadgeClass } from '~/lib/activityType'

const props = defineProps<{
  open: boolean
  date: Date | null
  events: CalendarEvent[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  'add': []
  'select': [event: CalendarEvent]
  'export': []
}>()

const dayLabel = computed(() => props.date?.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) ?? '')

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" class="w-full sm:max-w-md p-6 overflow-y-auto">
      <SheetHeader class="p-0">
        <SheetTitle>{{ dayLabel }}</SheetTitle>
        <SheetDescription>{{ events.length }} {{ events.length === 1 ? 'activity' : 'activities' }} scheduled</SheetDescription>
      </SheetHeader>

      <div class="flex items-center gap-2 pt-4">
        <Button size="sm" class="flex-1" @click="emit('add')">
          <Icon name="i-lucide-plus" class="mr-1.5 size-3.5" />
          Add Activity
        </Button>
        <Button size="sm" variant="outline" :disabled="!events.length" @click="emit('export')">
          <Icon name="i-lucide-download" class="mr-1.5 size-3.5" />
          Export
        </Button>
      </div>

      <div class="flex flex-col gap-2 pt-4">
        <button
          v-for="event in events"
          :key="event.id"
          type="button"
          class="flex flex-col gap-1.5 rounded-md border p-2.5 text-left hover:bg-accent/40"
          @click="emit('select', event)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="text-sm font-medium">{{ event.title }}</span>
            <span class="text-xs text-muted-foreground shrink-0">{{ formatTime(event.startAt) }} – {{ formatTime(event.endAt) }}</span>
          </div>
          <div class="flex flex-wrap items-center gap-1.5">
            <Badge v-if="event.activityType" :class="activityTypeBadgeClass(event.activityType)" class="text-[10px]">
              {{ event.activityType }}
            </Badge>
            <span v-if="event.location" class="flex items-center gap-1 text-xs text-muted-foreground">
              <Icon name="i-lucide-map-pin" class="size-3" />
              {{ event.location }}
            </span>
          </div>
          <div v-if="event.attendees.length" class="flex flex-wrap gap-1 pt-0.5">
            <Badge v-for="attendee in event.attendees" :key="attendee.id" variant="outline" class="text-[10px]">
              {{ attendee.name }}
            </Badge>
          </div>
        </button>

        <p v-if="!events.length" class="text-center text-sm text-muted-foreground py-8">
          No activities scheduled for this day.
        </p>
      </div>
    </SheetContent>
  </Sheet>
</template>
