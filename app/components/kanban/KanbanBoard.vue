<script setup lang="ts">
import type { SlaStatus, Ticket, TicketStatus } from '~/types/ticket'
import Draggable from 'vuedraggable'
import { priorities, statuses } from '../tickets/data/data'
import TicketDetailSheet from '../tickets/TicketDetailSheet.vue'

const { tickets, fetchTickets, updateStatus } = useTickets()

interface Column { status: TicketStatus, title: string, tasks: Ticket[] }

const board = ref<Column[]>(statuses.map(s => ({ status: s.value as TicketStatus, title: s.label, tasks: [] })))

function syncBoard() {
  for (const column of board.value)
    column.tasks = tickets.value.filter(t => t.status === column.status)
}

watch(tickets, syncBoard, { immediate: true })

onMounted(() => {
  fetchTickets()
})

const isDetailOpen = ref(false)
const selectedTicketId = ref<string | null>(null)
const selectedTicket = computed(() => tickets.value.find(t => t.id === selectedTicketId.value) ?? null)

async function openTicket(ticket: Ticket) {
  selectedTicketId.value = ticket.id
  isDetailOpen.value = true
}

async function onColumnChange(status: TicketStatus, evt: any) {
  const moved = evt?.added?.element as Ticket | undefined
  if (moved && moved.status !== status)
    await updateStatus(moved.id, status)
}

function priorityOption(p: Ticket['priority']) {
  return priorities.find(option => option.value === p)
}

function initials(name?: string) {
  return name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
}

const SLA_DOT_CLASS: Record<SlaStatus, string> = {
  'on-track': 'bg-emerald-500',
  'at-risk': 'bg-amber-500',
  'breached': 'bg-destructive',
}

const SLA_LABEL: Record<SlaStatus, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  'breached': 'SLA breached',
}
</script>

<template>
  <div class="flex gap-4 overflow-x-auto overflow-y-hidden pb-4">
    <Card v-for="col in board" :key="col.status" class="w-[280px] shrink-0 py-2 gap-4 self-start">
      <CardHeader class="flex flex-row items-center justify-between gap-2 px-2">
        <CardTitle class="font-semibold text-base flex items-center gap-2">
          <span>{{ col.title }}</span>
          <Badge variant="secondary" class="h-5 min-w-5 px-1 font-mono tabular-nums">
            {{ col.tasks.length }}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent class="px-2 overflow-y-auto overflow-x-hidden flex-1">
        <Draggable
          v-model="col.tasks"
          :group="{ name: 'kanban-tickets', pull: true, put: true }"
          item-key="id"
          :animation="180"
          class="flex flex-col gap-3 min-h-6 p-0.5"
          ghost-class="opacity-50"
          @change="onColumnChange(col.status, $event)"
        >
          <template #item="{ element: ticket }: { element: Ticket }">
            <div
              class="rounded-xl border bg-card px-3 py-2 shadow-sm hover:bg-accent/50 cursor-pointer"
              @click="openTicket(ticket)"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="text-xs font-mono text-muted-foreground">
                  {{ ticket.id }}
                </div>
                <Tooltip v-if="getSlaStatus(ticket)">
                  <TooltipTrigger as-child>
                    <span class="size-2 rounded-full shrink-0 mt-1" :class="SLA_DOT_CLASS[getSlaStatus(ticket)!]" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ SLA_LABEL[getSlaStatus(ticket)!] }}
                  </TooltipContent>
                </Tooltip>
              </div>
              <p class="font-medium leading-5 mt-1 line-clamp-2">
                {{ ticket.subject }}
              </p>
              <p class="text-xs text-muted-foreground mt-1">
                {{ ticket.requester }}
              </p>
              <div v-if="ticket.tags.length" class="mt-2 flex flex-wrap items-center gap-1">
                <Badge v-for="tag in ticket.tags.slice(0, 3)" :key="tag.id" variant="outline" class="text-[10px]">
                  {{ tag.name }}
                </Badge>
              </div>
              <div class="mt-3 flex items-center justify-between gap-2">
                <div class="flex items-center text-xs text-muted-foreground gap-1">
                  <Icon name="lucide:message-square" class="size-3.5" />
                  <span>{{ ticket.replies.length }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <component :is="priorityOption(ticket.priority)?.icon" class="size-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent class="capitalize">
                      {{ ticket.priority }}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip v-if="ticket.assigneeName">
                    <TooltipTrigger as-child>
                      <Avatar class="size-6">
                        <AvatarFallback class="text-[10px]">
                          {{ initials(ticket.assigneeName) }}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ ticket.assigneeName }}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </template>
        </Draggable>
      </CardContent>
    </Card>
  </div>

  <TicketDetailSheet v-model:open="isDetailOpen" :ticket="selectedTicket" />
</template>
