<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { Lead, LeadActivity, LeadStage } from '~/types/lead'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { leadStages } from './data'

const props = defineProps<{
  lead: Lead | null
}>()

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const { updateLead, convertLead, removeLead } = useLeads()
const { staff, fetchStaff } = useStaff()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const stage = computed(() => leadStages.find(s => s.value === props.lead?.stage))
const isConverted = computed(() => !!props.lead?.convertedClientId)
const isConverting = ref(false)

async function onStageChange(value: AcceptableValue) {
  if (!props.lead || value === null)
    return

  await updateLead(props.lead.id, { stage: value as LeadStage })
  toast('Stage updated', {
    description: `${props.lead.name} is now ${leadStages.find(s => s.value === value)?.label}.`,
  })
}

async function onAssigneesChange(assigneeIds: string[]) {
  if (!props.lead)
    return

  await updateLead(props.lead.id, { assigneeIds })
}

const notesDraft = ref('')
const sourceDraft = ref('')
const nextStepDraft = ref('')
const nameDraft = ref('')
const contactNameDraft = ref('')
const contactEmailDraft = ref('')
const contactPhoneDraft = ref('')
const df = new DateFormatter('en-US', { dateStyle: 'medium' })
const nextStepReminderField = useDateTimeField()

watch(() => props.lead?.id, () => {
  notesDraft.value = props.lead?.notes ?? ''
  sourceDraft.value = props.lead?.source ?? ''
  nextStepDraft.value = props.lead?.nextStep ?? ''
  nextStepReminderField.setFromIso(props.lead?.nextStepAt)
  nameDraft.value = props.lead?.name ?? ''
  contactNameDraft.value = props.lead?.contactName ?? ''
  contactEmailDraft.value = props.lead?.contactEmail ?? ''
  contactPhoneDraft.value = props.lead?.contactPhone ?? ''
}, { immediate: true })

async function saveDetails() {
  if (!props.lead || !nameDraft.value.trim())
    return

  await updateLead(props.lead.id, {
    name: nameDraft.value.trim(),
    contactName: contactNameDraft.value.trim(),
    contactEmail: contactEmailDraft.value.trim(),
    contactPhone: contactPhoneDraft.value.trim(),
  })
  toast('Details saved')
}

const isDeleting = ref(false)

async function onDelete() {
  if (!props.lead)
    return

  isDeleting.value = true
  try {
    const name = props.lead.name
    await removeLead(props.lead.id)
    open.value = false
    emit('deleted')
    toast('Lead deleted', { description: `${name} was removed.` })
  }
  finally {
    isDeleting.value = false
  }
}

async function saveNotes() {
  if (!props.lead)
    return

  await updateLead(props.lead.id, { notes: notesDraft.value })
  toast('Notes saved')
}

async function saveSource() {
  if (!props.lead)
    return

  await updateLead(props.lead.id, { source: sourceDraft.value })
  toast('Source saved')
}

async function saveNextStep() {
  if (!props.lead)
    return

  await updateLead(props.lead.id, {
    nextStep: nextStepDraft.value || null,
    nextStepAt: nextStepReminderField.toIso() ?? null,
  })
  toast('Next step saved', {
    description: nextStepReminderField.toIso() ? 'A reminder will notify you when it\'s due.' : undefined,
  })
}

async function onConvert() {
  if (!props.lead || isConverted.value)
    return

  isConverting.value = true
  try {
    const client = await convertLead(props.lead.id)
    toast('Lead converted', {
      description: `${client.name} is now an active client.`,
    })
    open.value = false
    router.push(`/clients?open=${client.id}`)
  }
  catch (error: any) {
    toast('Could not convert lead', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isConverting.value = false
  }
}

function activityLabel(activity: LeadActivity) {
  const actor = activity.actorName ?? 'Someone'

  switch (activity.type) {
    case 'stage_changed':
      return `${actor} moved this lead from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `${actor} assigned to ${activity.toValue}`
    case 'note_updated':
      return `${actor} updated the notes`
    case 'next_step_updated':
      return activity.toValue ? `${actor} set the next step: ${activity.toValue}` : `${actor} updated the next step`
    case 'converted':
      return `${actor} converted this lead to client ${activity.toValue}`
    default:
      return activity.message ?? `${actor} updated this lead`
  }
}

function formatDateTime(value: string) {
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
      <template v-if="lead">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ lead.id }}
          </SheetDescription>
          <SheetTitle>{{ lead.name }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Badge v-if="isConverted" variant="outline" class="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
              <Icon name="i-lucide-trophy" class="h-3.5 w-3.5" />
              Converted
            </Badge>
            <Select v-else :model-value="lead.stage" @update:model-value="onStageChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <component :is="stage?.icon" v-if="stage?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in leadStages" :key="s.value" :value="s.value">
                  <span class="flex items-center gap-2">
                    <component :is="s.icon" v-if="s.icon" class="h-3.5 w-3.5" />
                    {{ s.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-2">
            <span class="text-xs text-muted-foreground">Assigned to</span>
            <StaffAssigneePicker :model-value="lead.assignees.map(a => a.id)" :staff="activeStaff" @update:model-value="onAssigneesChange" />
          </div>
          <div class="text-sm text-muted-foreground pt-1 flex flex-col gap-0.5">
            <span v-if="lead.contactName">{{ lead.contactName }}</span>
            <span v-if="lead.contactEmail">{{ lead.contactEmail }}</span>
            <span v-if="lead.contactPhone">{{ lead.contactPhone }}</span>
          </div>
        </SheetHeader>

        <ScrollArea class="flex-1 min-h-0">
          <div class="flex flex-col gap-6 px-6 pt-4 pb-6">
            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Details
              </h4>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Lead / Company Name</Label>
                <Input v-model="nameDraft" placeholder="Company name" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Contact Name</Label>
                <Input v-model="contactNameDraft" placeholder="Jane Doe" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Contact Email</Label>
                  <Input v-model="contactEmailDraft" type="email" placeholder="jane@acme.com" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Contact Phone</Label>
                  <Input v-model="contactPhoneDraft" placeholder="Optional" />
                </div>
              </div>
              <div class="flex justify-end">
                <Button size="sm" variant="outline" :disabled="!nameDraft.trim()" @click="saveDetails">
                  Save Details
                </Button>
              </div>
            </div>

            <Separator />

            <div v-if="!isConverted" class="rounded-md border p-3 flex items-center justify-between gap-2">
              <div class="flex flex-col">
                <span class="text-sm font-medium">Ready to start the project?</span>
                <span class="text-xs text-muted-foreground">Converting creates a real client record.</span>
              </div>
              <Button size="sm" :disabled="isConverting" @click="onConvert">
                <Icon name="i-lucide-arrow-right-circle" class="mr-1.5 h-4 w-4" />
                Convert to Client
              </Button>
            </div>
            <div v-else class="rounded-md border p-3 flex items-center justify-between gap-2">
              <span class="text-sm text-muted-foreground">This lead has been converted.</span>
              <Button size="sm" variant="outline" as-child>
                <NuxtLink :to="`/clients?open=${lead.convertedClientId}`">
                  View client
                </NuxtLink>
              </Button>
            </div>

            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium flex items-center gap-1.5">
                <Icon name="i-lucide-alarm-clock" class="h-3.5 w-3.5 text-muted-foreground" />
                Next Step
              </h4>
              <Textarea v-model="nextStepDraft" rows="2" placeholder="What's the next action on this lead?" />
              <div class="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button variant="outline" :class="cn('flex-1 justify-start text-left font-normal px-3', !nextStepReminderField.date.value && 'text-muted-foreground')">
                      <Icon name="i-lucide-calendar" class="mr-2 h-4 w-4" />
                      {{ nextStepReminderField.date.value ? df.format(nextStepReminderField.date.value.toDate(getLocalTimeZone())) : 'Remind me at' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0">
                    <Calendar v-model="nextStepReminderField.date.value" initial-focus />
                  </PopoverContent>
                </Popover>
                <Input
                  v-model="nextStepReminderField.time.value"
                  type="time"
                  step="60"
                  class="w-28 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
              <div class="flex justify-end">
                <Button size="sm" variant="outline" @click="saveNextStep">
                  Save Next Step
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Source
              </h4>
              <div class="flex gap-2">
                <Input v-model="sourceDraft" placeholder="e.g. Referral, Website, Cold call" />
                <Button size="sm" variant="outline" @click="saveSource">
                  Save
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Notes
              </h4>
              <Textarea v-model="notesDraft" rows="3" placeholder="Notes about this lead..." />
              <div class="flex justify-end">
                <Button size="sm" variant="outline" @click="saveNotes">
                  Save Notes
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3 pb-6">
              <h4 class="text-sm font-medium">
                Activity
              </h4>
              <p v-if="!lead.activity.length" class="text-sm text-muted-foreground">
                No activity yet.
              </p>
              <div v-for="activity in lead.activity" :key="activity.id" class="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{{ activityLabel(activity) }}</span>
                <span>·</span>
                <span>{{ formatDateTime(activity.createdAt) }}</span>
              </div>
            </div>

            <Separator />

            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button variant="destructive">
                  <Icon name="i-lucide-trash-2" class="mr-2 h-4 w-4" />
                  Delete Lead
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {{ lead.name }}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this lead and its activity history. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction :disabled="isDeleting" @click="onDelete">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
