<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { Macro } from '~/types/automation'
import type { SlaStatus, Ticket, TicketActivity, TicketPriority, TicketReply, TicketStatus } from '~/types/ticket'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { escalationLevels, priorities, statuses } from './data/data'

const props = defineProps<{
  ticket: Ticket | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { addReply, updateTicket, addTag, removeTag, applyMacro, escalateTicket } = useTickets()
const { staff, fetchStaff } = useStaff()
const { tags, fetchTags, createTag } = useTags()
const { macros, fetchMacros } = useMacros()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
  if (!tags.value.length)
    fetchTags()
  if (!macros.value.length)
    fetchMacros()
})

const status = computed(() => statuses.find(s => s.value === props.ticket?.status))
const priority = computed(() => priorities.find(p => p.value === props.ticket?.priority))

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const ticketTagIds = computed(() => new Set(props.ticket?.tags.map(t => t.id) ?? []))
const availableTags = computed(() => tags.value.filter(t => !ticketTagIds.value.has(t.id)))

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
const slaStatus = computed(() => props.ticket ? getSlaStatus(props.ticket) : undefined)

async function onStatusChange(value: AcceptableValue) {
  if (!props.ticket || value === null)
    return

  await updateTicket(props.ticket.id, { status: value as TicketStatus })

  toast(value === 'closed' ? 'Ticket closed' : 'Status updated', {
    description: `${props.ticket.id} is now ${statuses.find(s => s.value === value)?.label.toLowerCase()}.`,
  })
}

async function onPriorityChange(value: AcceptableValue) {
  if (!props.ticket || value === null)
    return

  await updateTicket(props.ticket.id, { priority: value as TicketPriority })
}

async function onAssigneeChange(value: AcceptableValue) {
  if (!props.ticket)
    return

  const assigneeId = value === 'unassigned' ? null : value as string
  await updateTicket(props.ticket.id, { assigneeId })

  const name = staff.value.find(s => s.id === assigneeId)?.name
  toast('Assignee updated', {
    description: name ? `Assigned to ${name}.` : 'Ticket unassigned.',
  })
}

const escalation = computed(() => escalationLevels.find(l => l.value === props.ticket?.escalationLevel))
const canEscalateFurther = computed(() => {
  if (!props.ticket)
    return false
  const index = props.ticket.escalationLevel ? escalationLevels.findIndex(l => l.value === props.ticket!.escalationLevel) : -1
  return index < escalationLevels.length - 1
})

async function onEscalate() {
  if (!props.ticket)
    return

  try {
    const ticket = await escalateTicket(props.ticket.id)
    const label = escalationLevels.find(l => l.value === ticket.escalationLevel)?.label
    toast('Ticket escalated', {
      description: label ? `Escalated to ${label}.` : undefined,
    })
  }
  catch (error: any) {
    toast.error('Could not escalate', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

const isTagPopoverOpen = ref(false)
const newTagName = ref('')

async function toggleTag(tagId: string) {
  if (!props.ticket)
    return

  if (ticketTagIds.value.has(tagId))
    await removeTag(props.ticket.id, tagId)
  else
    await addTag(props.ticket.id, { tagId })
}

async function createAndAttachTag() {
  if (!props.ticket || !newTagName.value.trim())
    return

  const tag = await createTag(newTagName.value.trim())
  await addTag(props.ticket.id, { tagId: tag.id })
  newTagName.value = ''
}

const isMacroPopoverOpen = ref(false)

async function onApplyMacro(macro: Macro) {
  if (!props.ticket)
    return

  await applyMacro(props.ticket.id, macro.id)
  isMacroPopoverOpen.value = false
  toast('Macro applied', {
    description: `"${macro.name}" was applied to ${props.ticket.id}.`,
  })
}

const replySchema = toTypedSchema(z.object({
  message: z.string().min(1, { message: 'Reply cannot be empty.' }),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: replySchema,
  initialValues: { message: '' },
})

const isInternal = ref(false)

const onSubmit = handleSubmit(async (values) => {
  if (!props.ticket)
    return

  const internal = isInternal.value
  await addReply(props.ticket.id, values.message, internal)
  resetForm()
  isInternal.value = false
  toast(internal ? 'Internal note added' : 'Reply sent', {
    description: internal
      ? `Your note was added to ${props.ticket.id}.`
      : `Your reply was added to ${props.ticket.id}.`,
  })
})

type TimelineEntry
  = | { kind: 'reply', createdAt: string, data: TicketReply }
    | { kind: 'activity', createdAt: string, data: TicketActivity }

const timeline = computed<TimelineEntry[]>(() => {
  if (!props.ticket)
    return []

  const entries: TimelineEntry[] = [
    ...props.ticket.replies.map(reply => ({ kind: 'reply' as const, createdAt: reply.createdAt, data: reply })),
    ...props.ticket.activity.map(activity => ({ kind: 'activity' as const, createdAt: activity.createdAt, data: activity })),
  ]

  return entries.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})

function activityLabel(activity: TicketActivity) {
  const actor = activity.actorName ?? 'Someone'

  switch (activity.type) {
    case 'status_changed':
      return `${actor} changed status from ${activity.fromValue} to ${activity.toValue}`
    case 'priority_changed':
      return `${actor} changed priority from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `${actor} assigned to ${activity.toValue}`
    case 'escalated':
      return `${actor} escalated to ${activity.toValue}`
    case 'tag_added':
      return `${actor} added tag "${activity.toValue}"`
    case 'tag_removed':
      return `${actor} removed tag "${activity.fromValue}"`
    default:
      return activity.message ?? `${actor} updated the ticket`
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-lg p-0">
      <template v-if="ticket">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ ticket.id }}
          </SheetDescription>
          <SheetTitle>{{ ticket.subject }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline">
              {{ ticket.category }}
            </Badge>
            <Select :model-value="ticket.status" @update:model-value="onStatusChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 rounded-full px-2 text-xs" :class="status?.badgeClass">
                <component :is="status?.icon" v-if="status?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in statuses" :key="s.value" :value="s.value">
                  <span class="flex items-center gap-2">
                    <component :is="s.icon" v-if="s.icon" class="h-3.5 w-3.5" />
                    {{ s.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Select :model-value="ticket.priority" @update:model-value="onPriorityChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 rounded-full px-2 text-xs" :class="priority?.badgeClass">
                <component :is="priority?.icon" v-if="priority?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in priorities" :key="p.value" :value="p.value">
                  <span class="flex items-center gap-2">
                    <component :is="p.icon" v-if="p.icon" class="h-3.5 w-3.5" />
                    {{ p.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Tooltip v-if="slaStatus">
              <TooltipTrigger as-child>
                <Badge variant="outline" class="gap-1.5">
                  <span class="size-2 rounded-full" :class="SLA_DOT_CLASS[slaStatus]" />
                  {{ SLA_LABEL[slaStatus] }}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                Target: {{ ticket.dueAt ? formatDate(ticket.dueAt) : 'n/a' }}
              </TooltipContent>
            </Tooltip>
            <Badge v-if="escalation" variant="outline" class="gap-1.5" :class="escalation.badgeClass">
              <Icon name="i-lucide-arrow-up-circle" class="h-3.5 w-3.5" />
              {{ escalation.label }}
            </Badge>
            <Button v-if="canEscalateFurther" size="sm" variant="outline" class="h-7 gap-1.5 text-xs" @click="onEscalate">
              <Icon name="i-lucide-arrow-up-circle" class="h-3.5 w-3.5" />
              Escalate
            </Button>
          </div>

          <div class="flex flex-wrap items-center gap-2 pt-2">
            <span class="text-xs text-muted-foreground">Assignee</span>
            <Select :model-value="ticket.assigneeId ?? 'unassigned'" @update:model-value="onAssigneeChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  Unassigned
                </SelectItem>
                <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
                  {{ member.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="flex flex-wrap items-center gap-1.5 pt-2">
            <Badge v-for="tag in ticket.tags" :key="tag.id" variant="secondary" class="gap-1">
              {{ tag.name }}
              <button type="button" class="ml-0.5" @click="toggleTag(tag.id)">
                <Icon name="i-lucide-x" class="h-3 w-3" />
              </button>
            </Badge>
            <Popover v-model:open="isTagPopoverOpen">
              <PopoverTrigger as-child>
                <Button variant="outline" size="sm" class="h-6 gap-1 px-2 text-xs">
                  <Icon name="i-lucide-plus" class="h-3 w-3" />
                  Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-[220px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search tags..." />
                  <CommandList>
                    <CommandEmpty class="p-2 text-xs text-muted-foreground">
                      No matching tags.
                    </CommandEmpty>
                    <CommandGroup>
                      <CommandItem v-for="tag in availableTags" :key="tag.id" :value="tag.name" @select="toggleTag(tag.id)">
                        {{ tag.name }}
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
                <div class="flex items-center gap-1 border-t p-2">
                  <Input v-model="newTagName" placeholder="New tag name" class="h-7 text-xs" @keydown.enter.prevent="createAndAttachTag" />
                  <Button size="icon-sm" variant="ghost" class="size-7 shrink-0" :disabled="!newTagName.trim()" @click="createAndAttachTag">
                    <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <p class="text-sm text-muted-foreground pt-1">
            Requested by <span class="font-medium text-foreground">{{ ticket.requester }}</span> ({{ ticket.requesterEmail }}) on {{ formatDate(ticket.createdAt) }}
          </p>
          <p v-if="ticket.referenceNumber" class="text-xs text-muted-foreground">
            Reference: {{ ticket.referenceNumber }}
          </p>
        </SheetHeader>

        <ScrollArea class="flex-1 min-h-0">
          <div class="flex flex-col gap-6 px-6 pt-4 pb-6">
            <p class="text-sm leading-relaxed">
              {{ ticket.description }}
            </p>

            <div v-if="ticket.attachments?.length" class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Attachments
              </h4>
              <div class="flex flex-wrap gap-2">
                <Badge v-for="file in ticket.attachments" :key="file" variant="outline" class="gap-1">
                  <Icon name="i-lucide-paperclip" class="h-3 w-3" />
                  {{ file }}
                </Badge>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <h4 class="text-sm font-medium">
                Activity
              </h4>

              <p v-if="!timeline.length" class="text-sm text-muted-foreground">
                No activity yet.
              </p>

              <template v-for="entry in timeline" :key="`${entry.kind}-${entry.data.id}`">
                <div
                  v-if="entry.kind === 'reply'"
                  class="flex flex-col gap-1 rounded-md border p-3"
                  :class="(entry.data as TicketReply).internal ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30' : ''"
                >
                  <div class="flex items-center justify-between gap-2">
                    <span class="flex items-center gap-1.5 text-sm font-medium">
                      {{ (entry.data as TicketReply).author }}
                      <Badge v-if="(entry.data as TicketReply).internal" variant="outline" class="text-[10px] border-amber-400 text-amber-700 dark:text-amber-400">
                        Internal note
                      </Badge>
                    </span>
                    <span class="text-xs text-muted-foreground">{{ formatDate(entry.createdAt) }}</span>
                  </div>
                  <p class="text-sm text-muted-foreground whitespace-pre-wrap">
                    {{ (entry.data as TicketReply).message }}
                  </p>
                </div>
                <div v-else class="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <span>{{ activityLabel(entry.data as TicketActivity) }}</span>
                  <span>·</span>
                  <span>{{ formatDate(entry.createdAt) }}</span>
                </div>
              </template>
            </div>

            <Separator />

            <form class="flex flex-col gap-3 pb-6" @submit="onSubmit">
              <FormField v-slot="{ componentField }" name="message">
                <FormItem>
                  <FormLabel>{{ isInternal ? 'Internal note' : 'Reply' }}</FormLabel>
                  <FormControl>
                    <Textarea :placeholder="isInternal ? 'Add a note visible to staff only...' : 'Type your reply...'" rows="4" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <div class="flex items-center justify-between">
                <label for="internal-note" class="flex items-center gap-2 text-sm">
                  <Switch id="internal-note" v-model="isInternal" />
                  Internal note (not sent to customer)
                </label>

                <Popover v-model:open="isMacroPopoverOpen">
                  <PopoverTrigger as-child>
                    <Button type="button" variant="outline" size="sm" class="gap-1.5">
                      <Icon name="i-lucide-zap" class="h-3.5 w-3.5" />
                      Macros
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-[260px] p-0" align="end">
                    <Command>
                      <CommandInput placeholder="Search macros..." />
                      <CommandList>
                        <CommandEmpty class="p-3 text-xs text-muted-foreground">
                          No macros yet.
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem v-for="macro in macros" :key="macro.id" :value="macro.name" @select="onApplyMacro(macro)">
                            <div class="flex flex-col">
                              <span>{{ macro.name }}</span>
                              <span class="text-xs text-muted-foreground line-clamp-1">{{ macro.body }}</span>
                            </div>
                          </CommandItem>
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div class="flex justify-end">
                <Button type="submit">
                  {{ isInternal ? 'Add internal note' : 'Send reply' }}
                </Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
