<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { Tender, TenderActivity, TenderStage } from '~/types/tender'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { tenderStages } from './data'

const props = defineProps<{
  tender: Tender | null
}>()

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const { updateTender, convertTender, removeTender, uploadDocument, removeDocument } = useTenders()
const { staff, fetchStaff } = useStaff()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const stage = computed(() => tenderStages.find(s => s.value === props.tender?.stage))
const isConverted = computed(() => !!props.tender?.convertedClientId)
const isWon = computed(() => props.tender?.stage === 'won')
const isConverting = ref(false)

const weightedValue = computed(() => {
  if (!props.tender?.estimatedValue || !stage.value || props.tender.stage === 'won' || props.tender.stage === 'lost')
    return null
  return Math.round(props.tender.estimatedValue * (stage.value.probability / 100))
})

async function onStageChange(value: AcceptableValue) {
  if (!props.tender || value === null)
    return

  try {
    await updateTender(props.tender.id, { stage: value as TenderStage })
    toast('Stage updated', {
      description: `${props.tender.title} is now ${tenderStages.find(s => s.value === value)?.label}.`,
    })
  }
  catch (error: any) {
    toast.error('Could not update stage', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

async function onAssigneesChange(assigneeIds: string[]) {
  if (!props.tender)
    return

  await updateTender(props.tender.id, { assigneeIds })
}

const notesDraft = ref('')
const sourceDraft = ref('')
const titleDraft = ref('')
const issuingAuthorityDraft = ref('')
const referenceNumberDraft = ref('')
const contactNameDraft = ref('')
const contactEmailDraft = ref('')
const contactPhoneDraft = ref('')
const estimatedValueDraft = ref('')
const df = new DateFormatter('en-US', { dateStyle: 'medium' })
const deadlineField = useDateTimeField()

watch(() => props.tender?.id, () => {
  notesDraft.value = props.tender?.notes ?? ''
  sourceDraft.value = props.tender?.source ?? ''
  titleDraft.value = props.tender?.title ?? ''
  issuingAuthorityDraft.value = props.tender?.issuingAuthority ?? ''
  referenceNumberDraft.value = props.tender?.referenceNumber ?? ''
  contactNameDraft.value = props.tender?.contactName ?? ''
  contactEmailDraft.value = props.tender?.contactEmail ?? ''
  contactPhoneDraft.value = props.tender?.contactPhone ?? ''
  estimatedValueDraft.value = props.tender?.estimatedValue !== undefined ? String(props.tender.estimatedValue) : ''
  deadlineField.setFromIso(props.tender?.submissionDeadline)
}, { immediate: true })

async function saveDetails() {
  if (!props.tender || !titleDraft.value.trim())
    return

  await updateTender(props.tender.id, {
    title: titleDraft.value.trim(),
    issuingAuthority: issuingAuthorityDraft.value.trim(),
    referenceNumber: referenceNumberDraft.value.trim(),
    contactName: contactNameDraft.value.trim(),
    contactEmail: contactEmailDraft.value.trim(),
    contactPhone: contactPhoneDraft.value.trim(),
    estimatedValue: estimatedValueDraft.value.trim() ? Number(estimatedValueDraft.value.trim()) : null,
  })
  toast('Details saved')
}

async function saveDeadline() {
  if (!props.tender)
    return

  await updateTender(props.tender.id, {
    submissionDeadline: deadlineField.toIso() ?? null,
  })
  toast('Deadline saved', {
    description: deadlineField.toIso() ? 'A reminder will notify assignees when it\'s due.' : undefined,
  })
}

async function saveSource() {
  if (!props.tender)
    return

  await updateTender(props.tender.id, { source: sourceDraft.value })
  toast('Source saved')
}

async function saveNotes() {
  if (!props.tender)
    return

  await updateTender(props.tender.id, { notes: notesDraft.value })
  toast('Notes saved')
}

const documentInput = ref<HTMLInputElement>()
const isUploadingDocument = ref(false)

function onUploadButtonClick() {
  documentInput.value?.click()
}

async function onDocumentChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!props.tender || !file)
    return

  isUploadingDocument.value = true
  try {
    await uploadDocument(props.tender.id, file)
    toast('Document uploaded')
  }
  catch (error: any) {
    toast.error('Could not upload document', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isUploadingDocument.value = false
    input.value = ''
  }
}

async function onRemoveDocument(docId: string) {
  if (!props.tender)
    return
  await removeDocument(props.tender.id, docId)
}

function formatFileSize(bytes?: number) {
  if (!bytes)
    return ''
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const isDeleting = ref(false)

async function onDelete() {
  if (!props.tender)
    return

  isDeleting.value = true
  try {
    const title = props.tender.title
    await removeTender(props.tender.id)
    open.value = false
    emit('deleted')
    toast('Tender deleted', { description: `${title} was removed.` })
  }
  finally {
    isDeleting.value = false
  }
}

async function onConvert() {
  if (!props.tender || isConverted.value || !isWon.value)
    return

  isConverting.value = true
  try {
    const client = await convertTender(props.tender.id)
    toast('Tender converted', {
      description: `${client.name} is now an active client.`,
    })
    open.value = false
    router.push(`/clients?open=${client.id}`)
  }
  catch (error: any) {
    toast.error('Could not convert tender', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isConverting.value = false
  }
}

function activityLabel(activity: TenderActivity) {
  const actor = activity.actorName ?? 'Someone'

  switch (activity.type) {
    case 'stage_changed':
      return `${actor} moved this tender from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `${actor} assigned to ${activity.toValue}`
    case 'note_updated':
      return `${actor} updated the notes`
    case 'deadline_updated':
      return activity.toValue ? `${actor} set the submission deadline` : `${actor} updated the submission deadline`
    case 'document_added':
      return `${actor} uploaded ${activity.toValue}`
    case 'document_removed':
      return `${actor} removed ${activity.fromValue}`
    case 'converted':
      return `${actor} converted this tender to client ${activity.toValue}`
    default:
      return activity.message ?? `${actor} updated this tender`
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
      <template v-if="tender">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ tender.id }}
          </SheetDescription>
          <SheetTitle>{{ tender.title }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Badge v-if="isConverted" variant="outline" class="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
              <Icon name="i-lucide-trophy" class="h-3.5 w-3.5" />
              Converted
            </Badge>
            <Select v-else :model-value="tender.stage" @update:model-value="onStageChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <component :is="stage?.icon" v-if="stage?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in tenderStages" :key="s.value" :value="s.value">
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
            <StaffAssigneePicker :model-value="tender.assignees.map(a => a.id)" :staff="activeStaff" @update:model-value="onAssigneesChange" />
          </div>
          <div class="text-sm text-muted-foreground pt-1 flex flex-col gap-0.5">
            <span v-if="tender.issuingAuthority">{{ tender.issuingAuthority }}</span>
            <span v-if="tender.contactName">{{ tender.contactName }}</span>
            <span v-if="tender.contactEmail">{{ tender.contactEmail }}</span>
          </div>
        </SheetHeader>

        <ScrollArea class="flex-1 min-h-0">
          <div class="flex flex-col gap-6 px-6 pt-4 pb-6">
            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Details
              </h4>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Tender Title</Label>
                <Input v-model="titleDraft" placeholder="Tender title" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Issuing Authority</Label>
                  <Input v-model="issuingAuthorityDraft" placeholder="e.g. Ministry of Works" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Reference Number</Label>
                  <Input v-model="referenceNumberDraft" placeholder="Optional" />
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Contact Name</Label>
                <Input v-model="contactNameDraft" placeholder="Jane Doe" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Contact Email</Label>
                  <Input v-model="contactEmailDraft" type="email" placeholder="jane@authority.gov" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Contact Phone</Label>
                  <Input v-model="contactPhoneDraft" placeholder="Optional" />
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Estimated Value</Label>
                <Input v-model="estimatedValueDraft" type="number" placeholder="Optional" />
                <p v-if="weightedValue !== null" class="text-xs text-muted-foreground">
                  Weighted: {{ weightedValue.toLocaleString() }} at {{ stage?.probability }}%
                </p>
              </div>
              <div class="flex justify-end">
                <Button size="sm" variant="outline" :disabled="!titleDraft.trim()" @click="saveDetails">
                  Save Details
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium flex items-center gap-1.5">
                <Icon name="i-lucide-alarm-clock" class="h-3.5 w-3.5 text-muted-foreground" />
                Submission Deadline
              </h4>
              <div class="flex items-center gap-1">
                <Popover>
                  <PopoverTrigger as-child>
                    <Button variant="outline" :class="cn('flex-1 justify-start text-left font-normal px-3', !deadlineField.date.value && 'text-muted-foreground')">
                      <Icon name="i-lucide-calendar" class="mr-2 h-4 w-4" />
                      {{ deadlineField.date.value ? df.format(deadlineField.date.value.toDate(getLocalTimeZone())) : 'Set deadline' }}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-auto p-0">
                    <Calendar v-model="deadlineField.date.value" initial-focus />
                  </PopoverContent>
                </Popover>
                <Input
                  v-model="deadlineField.time.value"
                  type="time"
                  step="60"
                  class="w-28 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                />
              </div>
              <div class="flex justify-end">
                <Button size="sm" variant="outline" @click="saveDeadline">
                  Save Deadline
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <h4 class="text-sm font-medium flex items-center justify-between">
                <span>Documents</span>
                <Button size="sm" variant="outline" :disabled="isUploadingDocument" @click="onUploadButtonClick">
                  <Icon name="i-lucide-upload" class="mr-1.5 h-3.5 w-3.5" />
                  Upload
                </Button>
              </h4>
              <input ref="documentInput" type="file" class="hidden" @change="onDocumentChange">
              <p v-if="!tender.documents.length" class="text-sm text-muted-foreground">
                No documents uploaded yet.
              </p>
              <div v-for="document in tender.documents" :key="document.id" class="flex items-center gap-2 rounded-md border p-2 text-sm">
                <Icon name="i-lucide-paperclip" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <a :href="document.url" target="_blank" rel="noopener noreferrer" class="flex-1 truncate hover:underline">
                  {{ document.name }}
                </a>
                <span class="shrink-0 text-xs text-muted-foreground">{{ formatFileSize(document.size) }}</span>
                <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground" @click="onRemoveDocument(document.id)">
                  <Icon name="i-lucide-x" class="size-3" />
                </Button>
              </div>
            </div>

            <Separator />

            <AiSuggestionCard regarding-type="tender" :regarding-id="tender.id" />

            <Separator />

            <InteractionsSection regarding-type="tender" :regarding-id="tender.id" :interactions="tender.interactions" />

            <Separator />

            <QuotesSection
              regarding-type="tender"
              :regarding-id="tender.id"
              :record-name="tender.title"
              :contact-name="tender.contactName"
              :contact-email="tender.contactEmail"
              :contact-phone="tender.contactPhone"
            />

            <Separator />

            <div v-if="isWon && !isConverted" class="rounded-md border p-3 flex items-center justify-between gap-2">
              <div class="flex flex-col">
                <span class="text-sm font-medium">Won the tender?</span>
                <span class="text-xs text-muted-foreground">Converting creates a real client record.</span>
              </div>
              <Button size="sm" :disabled="isConverting" @click="onConvert">
                <Icon name="i-lucide-arrow-right-circle" class="mr-1.5 h-4 w-4" />
                Convert to Client
              </Button>
            </div>
            <div v-else-if="isConverted" class="rounded-md border p-3 flex items-center justify-between gap-2">
              <span class="text-sm text-muted-foreground">This tender has been converted.</span>
              <Button size="sm" variant="outline" as-child>
                <NuxtLink :to="`/clients?open=${tender.convertedClientId}`">
                  View client
                </NuxtLink>
              </Button>
            </div>

            <Separator v-if="isWon || isConverted" />

            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Source
              </h4>
              <div class="flex gap-2">
                <Input v-model="sourceDraft" placeholder="e.g. Tender portal, Referral" />
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
              <Textarea v-model="notesDraft" rows="3" placeholder="Notes about this tender..." />
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
              <p v-if="!tender.activity.length" class="text-sm text-muted-foreground">
                No activity yet.
              </p>
              <div v-for="activity in tender.activity" :key="activity.id" class="flex items-center justify-center gap-2 text-xs text-muted-foreground">
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
                  Delete Tender
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {{ tender.title }}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove this tender, its documents, and its activity history. This action cannot be undone.
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
