<script setup lang="ts">
import type { Task } from '~/types/task'
import type { TenderActivity, TenderStage } from '~/types/tender'
import { toast } from 'vue-sonner'
import { priorities } from '~/components/tasks/data'
import TaskFormSheet from '~/components/tasks/TaskFormSheet.vue'
import { tenderStages } from '~/components/tenders/data'
import { parseAmountInput } from '~/lib/formNumbers'
import { getTaskDueStatus } from '~/lib/tasks'

// Tender record ("Web app — Opportunity record" in the Canopy design) — a full page.
definePageMeta({ middleware: 'bd' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { tenders, fetchTender, updateTender, convertTender, removeTender, uploadDocument, removeDocument } = useTenders()
const { staff, fetchStaff } = useStaff()
const { fetchTasksForTender } = useTasks()
const { statuses: taskStatuses, fetchStatuses: fetchTaskStatuses } = useTaskStatuses()

const tender = computed(() => tenders.value.find(t => t.id === id.value) ?? null)
const notFound = ref(false)

onMounted(async () => {
  try {
    await fetchTender(id.value)
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
  }
  if (!staff.value.length)
    await fetchStaff()
  if (!taskStatuses.value.length)
    await fetchTaskStatuses()
  await loadTasks()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const PROCESS = tenderStages.filter(s => s.value !== 'lost').map(s => ({ value: s.value as TenderStage, label: s.label }))
const stageInfo = computed(() => tenderStages.find(s => s.value === tender.value?.stage))
const isConverted = computed(() => !!tender.value?.convertedClientId)
const money = (value?: number | null) => value === undefined || value === null ? '—' : value.toLocaleString()
const dateLabel = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const daysInStage = computed(() => {
  if (!tender.value)
    return undefined
  const lastMove = tender.value.activity.find(a => a.type === 'stage_changed')?.createdAt ?? tender.value.createdAt
  const days = Math.floor((Date.now() - new Date(lastMove).getTime()) / 86400000)
  return days < 1 ? 'Today' : `${days} d`
})
const stats = computed(() => tender.value
  ? [
      { label: 'Est. value', value: money(tender.value.estimatedValue) },
      { label: 'Weighted', value: tender.value.estimatedValue && !['won', 'lost'].includes(tender.value.stage) ? `${money(Math.round(tender.value.estimatedValue * (stageInfo.value?.probability ?? 0) / 100))} · ${stageInfo.value?.probability ?? 0}%` : '—' },
      { label: 'Deadline', value: tender.value.submissionDeadline ? new Date(tender.value.submissionDeadline).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '—' },
      { label: 'Owner', value: tender.value.assignees.map(a => a.name).join(', ') || 'Unassigned' },
    ]
  : [])

// ── Details form ──────────────────────────────────────────────────────────
const form = reactive({ title: '', issuingAuthority: '', referenceNumber: '', contactName: '', contactEmail: '', contactPhone: '', estimatedValue: '', source: '', notes: '', deadline: '' })
function toLocalInput(iso?: string) {
  if (!iso)
    return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function snapshot() {
  const t = tender.value!
  return {
    title: t.title,
    issuingAuthority: t.issuingAuthority ?? '',
    referenceNumber: t.referenceNumber ?? '',
    contactName: t.contactName ?? '',
    contactEmail: t.contactEmail ?? '',
    contactPhone: t.contactPhone ?? '',
    estimatedValue: t.estimatedValue !== undefined ? String(t.estimatedValue) : '',
    source: t.source ?? '',
    notes: t.notes ?? '',
    deadline: toLocalInput(t.submissionDeadline),
  }
}
watch(() => tender.value?.id, () => tender.value && Object.assign(form, snapshot()), { immediate: true })
const isDirty = computed(() => !!tender.value && JSON.stringify(form) !== JSON.stringify(snapshot()))

const saving = ref(false)
async function save() {
  if (!tender.value || !form.title.trim())
    return
  saving.value = true
  try {
    await updateTender(tender.value.id, {
      title: form.title.trim(),
      issuingAuthority: form.issuingAuthority.trim(),
      referenceNumber: form.referenceNumber.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      estimatedValue: parseAmountInput(form.estimatedValue) ?? null,
      source: form.source.trim(),
      notes: form.notes,
      submissionDeadline: form.deadline ? new Date(form.deadline).toISOString() : null,
    })
    toast('Tender saved')
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    saving.value = false
  }
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

async function moveStage(stage: TenderStage) {
  if (!tender.value)
    return
  try {
    await updateTender(tender.value.id, { stage })
    toast(`Moved to ${tenderStages.find(s => s.value === stage)?.label}`)
  }
  catch (error: any) {
    toast.error('Could not update stage', { description: error?.data?.statusMessage })
  }
}

async function onAssigneesChange(assigneeIds: string[]) {
  if (tender.value)
    await updateTender(tender.value.id, { assigneeIds })
}

const converting = ref(false)
async function convert() {
  if (!tender.value)
    return
  converting.value = true
  try {
    const client = await convertTender(tender.value.id)
    toast('Tender converted', { description: `${client.name} is now a client.` })
    await navigateTo(`/clients/${client.id}`)
  }
  catch (error: any) {
    toast.error('Could not convert', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    converting.value = false
  }
}

const isDeleteOpen = ref(false)
async function onDelete() {
  if (!tender.value)
    return
  const title = tender.value.title
  await removeTender(tender.value.id)
  toast('Tender deleted', { description: `${title} was removed.` })
  await navigateTo('/tenders')
}

// ── Tasks ─────────────────────────────────────────────────────────────────
const tasks = ref<Task[]>([])
async function loadTasks() {
  tasks.value = await fetchTasksForTender(id.value).catch(() => [])
}
const isTaskFormOpen = ref(false)
const editingTask = ref<Task | null>(null)
function openTask(task: Task | null) {
  editingTask.value = task
  isTaskFormOpen.value = true
}
watch(isTaskFormOpen, open => !open && loadTasks())
const DUE_CLASS: Record<string, string> = { 'on-track': 'text-muted-foreground', 'due-soon': 'text-amber-600 dark:text-amber-400', 'overdue': 'text-destructive' }
const taskStatusLabel = (task: Task) => taskStatuses.value.find(s => s.id === task.status)?.label ?? task.status

function activityLabel(activity: TenderActivity) {
  switch (activity.type) {
    case 'stage_changed':
      return `Moved from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `Assigned to ${activity.toValue}`
    case 'note_updated':
      return 'Notes updated'
    case 'deadline_updated':
      return 'Submission deadline changed'
    case 'document_added':
      return `Uploaded ${activity.toValue}`
    case 'document_removed':
      return `Removed ${activity.fromValue}`
    case 'converted':
      return `Converted to client ${activity.toValue}`
    default:
      return activity.message ?? 'Updated'
  }
}
const timeline = computed(() => tender.value
  ? [
      ...tender.value.activity.map(a => ({ id: a.id, label: activityLabel(a), actor: a.actorName, at: a.createdAt })),
      { id: 'created', label: 'Tender created', actor: tender.value.source ? `Source: ${tender.value.source}` : undefined, at: tender.value.createdAt },
    ]
  : [])
const tab = ref('summary')
const deadlineLeft = computed(() => {
  if (!tender.value?.submissionDeadline)
    return null
  const days = Math.ceil((new Date(tender.value.submissionDeadline).getTime() - Date.now()) / 86400000)
  return days < 0 ? `${-days} day${days === -1 ? '' : 's'} ago` : days === 0 ? 'Today' : `In ${days} day${days === 1 ? '' : 's'}`
})
</script>

<template>
  <div class="w-full">
    <p v-if="notFound" class="text-muted-foreground">
      This tender doesn't exist or was deleted. <NuxtLink to="/tenders" class="underline">
        Back to tenders
      </NuxtLink>
    </p>

    <RecordPage
      v-else-if="tender"
      v-model:tab="tab"
      back-to="/tenders"
      back-label="Back to tenders"
      actions-label="Tender actions"
      :eyebrow="['Tender', tender.issuingAuthority || tender.source || 'No source', tender.id].filter(Boolean).join(' · ')"
      :title="tender.title"
      :subtitle="[tender.contactName, tender.contactEmail].filter(Boolean).join(' · ') || undefined"
      :stats="stats"
      :stages="PROCESS"
      :stage="tender.stage"
      :stage-note="daysInStage"
      :stage-readonly="isConverted"
      :closed-label="tender.stage === 'lost' ? 'This tender was lost.' : undefined"
      regarding-type="tender"
      :regarding-id="tender.id"
      :record-name="tender.title"
      :contact="{ name: tender.contactName, email: tender.contactEmail, phone: tender.contactPhone }"
      :interactions="tender.interactions"
      :documents="tender.documents"
      :upload="(file) => uploadDocument(tender!.id, file)"
      :remove-document="(docId) => removeDocument(tender!.id, docId)"
      :timeline="timeline"
      :extra-tabs="[{ value: 'tasks', label: 'Tasks', count: tasks.length }]"
      @stage="(value) => moveStage(value as TenderStage)"
      @reopen="moveStage('evaluation')"
    >
      <template #actions>
        <Button variant="lime" :disabled="saving || !isDirty || !form.title.trim()" @click="save">
          Save
        </Button>
        <template v-if="!isConverted">
          <Button v-if="tender.stage === 'won'" variant="ghost" :disabled="converting" @click="convert">
            Convert to client
          </Button>
          <Button v-else variant="ghost" @click="moveStage('won')">
            Mark as won
          </Button>
          <Button v-if="tender.stage !== 'lost'" variant="ghost" @click="moveStage('lost')">
            Mark as lost
          </Button>
        </template>
        <Button v-else variant="ghost" as-child>
          <NuxtLink :to="`/clients/${tender.convertedClientId}`">
            Open client
          </NuxtLink>
        </Button>
        <Button variant="ghost" @click="tab = 'quotes'">
          New quote
        </Button>
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="ghost">
              Assign
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-80" align="start">
            <StaffAssigneePicker :model-value="tender.assignees.map(a => a.id)" :staff="activeStaff" @update:model-value="onAssigneesChange" />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="isDeleteOpen = true">
          Delete
        </Button>
      </template>

      <template #details>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <Label for="rec-name" class="text-[13px] font-semibold">Tender title</Label>
            <Input id="rec-name" v-model="form.title" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rec-contact" class="text-[13px] font-semibold">Contact name</Label>
            <Input id="rec-contact" v-model="form.contactName" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rec-value" class="text-[13px] font-semibold">Estimated value</Label>
            <Input id="rec-value" v-model="form.estimatedValue" inputmode="decimal" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rec-email" class="text-[13px] font-semibold">Email</Label>
            <Input id="rec-email" v-model="form.contactEmail" type="email" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rec-phone" class="text-[13px] font-semibold">Phone</Label>
            <Input id="rec-phone" v-model="form.contactPhone" type="tel" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rec-authority" class="text-[13px] font-semibold">Issuing authority</Label>
            <Input id="rec-authority" v-model="form.issuingAuthority" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="rec-ref" class="text-[13px] font-semibold">Reference</Label>
            <Input id="rec-ref" v-model="form.referenceNumber" />
          </div>
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <Label for="rec-source" class="text-[13px] font-semibold">Source</Label>
            <Input id="rec-source" v-model="form.source" placeholder="e.g. Tender portal, Referral" />
          </div>
        </div>
        <div class="flex flex-col gap-1.5">
          <Label for="rec-notes" class="text-[13px] font-semibold">Notes</Label>
          <Textarea id="rec-notes" v-model="form.notes" rows="3" placeholder="Scope, requirements, evaluation criteria…" />
        </div>
      </template>

      <template #key-card>
        <RecordCard title="Submission deadline" tone="mist">
          <div v-if="tender.submissionDeadline" class="text-2xl font-black tracking-[-0.03em]">
            {{ dateLabel(tender.submissionDeadline) }} <span class="text-sm font-semibold">{{ deadlineLeft }}</span>
          </div>
          <Label for="rec-key-at" class="text-[13px] font-semibold">Deadline</Label>
          <Input id="rec-key-at" v-model="form.deadline" type="datetime-local" class="bg-card" />
          <p class="m-0 text-xs">
            Assignees get a reminder before it's due. Saved with Save.
          </p>
        </RecordCard>
      </template>

      <template #tab-tasks>
        <RecordCard title="Tasks">
          <template #actions>
            <Button size="sm" variant="outline" @click="openTask(null)">
              <Icon name="i-lucide-plus" /> Add task
            </Button>
          </template>
          <p v-if="!tasks.length" class="m-0 text-sm text-muted-foreground">
            No tasks linked to this tender yet.
          </p>
          <button v-for="task in tasks" :key="task.id" type="button" class="flex flex-col gap-1.5 rounded-2xl bg-muted/50 p-3 text-left hover:bg-muted" @click="openTask(task)">
            <span class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-semibold text-foreground">{{ task.title }}</span>
              <Badge variant="outline" class="shrink-0 text-[10px]">{{ taskStatusLabel(task) }}</Badge>
            </span>
            <span class="flex flex-wrap items-center gap-2 text-xs">
              <Badge v-if="priorities.find(p => p.value === task.priority)" variant="outline" class="text-[10px]" :class="priorities.find(p => p.value === task.priority)?.badgeClass">{{ priorities.find(p => p.value === task.priority)?.label }}</Badge>
              <span v-if="task.dueDate" :class="DUE_CLASS[getTaskDueStatus(task) ?? 'on-track']">Due {{ dateLabel(task.dueDate) }}</span>
              <span class="ml-auto text-muted-foreground">{{ task.assignees.map(a => a.name).join(', ') || 'Unassigned' }}</span>
            </span>
          </button>
        </RecordCard>
      </template>

      <TaskFormSheet v-model:open="isTaskFormOpen" :task="editingTask" :tender-id="tender.id" />

      <AlertDialog v-model:open="isDeleteOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {{ tender.title }}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the tender and its activity history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" @click="onDelete">
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RecordPage>

    <p v-else class="text-sm text-muted-foreground">
      Loading…
    </p>
  </div>
</template>
