<script setup lang="ts">
import type { LeadActivity, LeadStage } from '~/types/lead'
import { toast } from 'vue-sonner'
import { leadStages } from '~/components/leads/data'
import { parseAmountInput } from '~/lib/formNumbers'

// Lead record ("2 · Lead record & qualify" in the Canopy design) — a full page, not a side sheet.
definePageMeta({ middleware: 'bd' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { leads, fetchLead, updateLead, convertLead, removeLead, addContactEmail, removeContactEmail, addContactPhone, removeContactPhone, uploadDocument, removeDocument } = useLeads()
const { staff, fetchStaff } = useStaff()

const lead = computed(() => leads.value.find(l => l.id === id.value) ?? null)
const notFound = ref(false)

onMounted(async () => {
  try {
    await fetchLead(id.value)
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
  }
  if (!staff.value.length)
    await fetchStaff()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const PROCESS: { value: LeadStage, label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
]
const stageInfo = computed(() => leadStages.find(s => s.value === lead.value?.stage))
const isConverted = computed(() => !!lead.value?.convertedClientId)
const money = (value?: number | null) => value === undefined || value === null ? '—' : value.toLocaleString()
const weighted = computed(() => lead.value?.estimatedValue && stageInfo.value && !['won', 'lost'].includes(lead.value.stage) ? Math.round(lead.value.estimatedValue * stageInfo.value.probability / 100) : null)
const daysInStage = computed(() => {
  if (!lead.value)
    return undefined
  const lastMove = lead.value.activity.find(a => a.type === 'stage_changed')?.createdAt ?? lead.value.createdAt
  const days = Math.floor((Date.now() - new Date(lastMove).getTime()) / 86400000)
  return days < 1 ? 'Today' : `${days} d`
})

const stats = computed(() => lead.value
  ? [
      { label: 'Est. value', value: money(lead.value.estimatedValue) },
      { label: 'Weighted', value: weighted.value === null ? '—' : `${money(weighted.value)} · ${stageInfo.value?.probability}%` },
      { label: 'Next step', value: lead.value.nextStepAt ? new Date(lead.value.nextStepAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : '—' },
      { label: 'Owner', value: lead.value.assignees.map(a => a.name).join(', ') || 'Unassigned' },
    ]
  : [])

// ── Details form (Save in the toolbar) ────────────────────────────────────
const nextStep = reactive({ text: '', at: '' })
function toLocalInput(iso: string) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const form = reactive({ name: '', contactName: '', contactEmail: '', contactPhone: '', estimatedValue: '', source: '', notes: '' })
watch(() => lead.value?.id, () => {
  if (!lead.value)
    return
  Object.assign(form, {
    name: lead.value.name,
    contactName: lead.value.contactName ?? '',
    contactEmail: lead.value.contactEmail ?? '',
    contactPhone: lead.value.contactPhone ?? '',
    estimatedValue: lead.value.estimatedValue !== undefined ? String(lead.value.estimatedValue) : '',
    source: lead.value.source ?? '',
    notes: lead.value.notes ?? '',
  })
  nextStep.text = lead.value.nextStep ?? ''
  nextStep.at = lead.value.nextStepAt ? toLocalInput(lead.value.nextStepAt) : ''
}, { immediate: true })

const isDirty = computed(() => !!lead.value && (
  form.name !== lead.value.name
  || form.contactName !== (lead.value.contactName ?? '')
  || form.contactEmail !== (lead.value.contactEmail ?? '')
  || form.contactPhone !== (lead.value.contactPhone ?? '')
  || form.estimatedValue !== (lead.value.estimatedValue !== undefined ? String(lead.value.estimatedValue) : '')
  || form.source !== (lead.value.source ?? '')
  || form.notes !== (lead.value.notes ?? '')
))

const saving = ref(false)
async function save() {
  if (!lead.value || !form.name.trim())
    return
  saving.value = true
  try {
    await updateLead(lead.value.id, {
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      estimatedValue: parseAmountInput(form.estimatedValue) ?? null,
      source: form.source.trim(),
      notes: form.notes,
    })
    toast('Lead saved')
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    saving.value = false
  }
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

async function moveStage(stage: LeadStage) {
  if (!lead.value)
    return
  try {
    await updateLead(lead.value.id, { stage })
    toast(`Moved to ${leadStages.find(s => s.value === stage)?.label}`)
  }
  catch (error: any) {
    toast.error('Could not update stage', { description: error?.data?.statusMessage })
  }
}

async function onAssigneesChange(assigneeIds: string[]) {
  if (lead.value)
    await updateLead(lead.value.id, { assigneeIds })
}

// ── Next step ─────────────────────────────────────────────────────────────
async function saveNextStep() {
  if (!lead.value)
    return
  const at = nextStep.at ? new Date(nextStep.at).toISOString() : null
  await updateLead(lead.value.id, { nextStep: nextStep.text || null, nextStepAt: at })
  toast('Next step saved', { description: at ? 'You\'ll get a reminder when it\'s due.' : undefined })
}

// ── Qualify → client (the design's "Qualify lead" dialog) ─────────────────
const isQualifyOpen = ref(false)
const converting = ref(false)
const { matches: clientMatches, check: checkClient } = useDuplicateCheck('clients')
watch(isQualifyOpen, (open) => {
  if (open && lead.value)
    checkClient({ name: lead.value.name, email: lead.value.contactEmail, phone: lead.value.contactPhone })
})
async function qualify() {
  if (!lead.value)
    return
  converting.value = true
  try {
    const client = await convertLead(lead.value.id)
    toast('Lead converted', { description: `${client.name} is now a client.` })
    await navigateTo(`/clients/${client.id}`)
  }
  catch (error: any) {
    toast.error('Could not convert', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    converting.value = false
    isQualifyOpen.value = false
  }
}

const isDeleteOpen = ref(false)
async function onDelete() {
  if (!lead.value)
    return
  const name = lead.value.name
  await removeLead(lead.value.id)
  toast('Lead deleted', { description: `${name} was removed.` })
  await navigateTo('/leads')
}

function activityLabel(activity: LeadActivity) {
  switch (activity.type) {
    case 'stage_changed':
      return `Moved from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `Assigned to ${activity.toValue}`
    case 'note_updated':
      return activity.message ?? 'Notes updated'
    case 'next_step_updated':
      return activity.toValue ? `Next step: ${activity.toValue}` : 'Next step updated'
    case 'converted':
      return `Converted to client ${activity.toValue}`
    default:
      return activity.message ?? 'Updated'
  }
}
const timeline = computed(() => lead.value
  ? [
      ...lead.value.activity.map(a => ({ id: a.id, label: activityLabel(a), actor: a.actorName, at: a.createdAt })),
      { id: 'created', label: 'Lead created', actor: lead.value.source ? `Source: ${lead.value.source}` : undefined, at: lead.value.createdAt },
    ]
  : [])
const tab = ref('summary')
const dateLabel = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
</script>

<template>
  <div class="w-full">
    <p v-if="notFound" class="text-muted-foreground">
      This lead doesn't exist or was deleted. <NuxtLink to="/leads" class="underline">
        Back to leads
      </NuxtLink>
    </p>

    <RecordPage
      v-else-if="lead"
      v-model:tab="tab"
      back-to="/leads"
      back-label="Back to leads"
      actions-label="Lead actions"
      :eyebrow="`Lead · ${lead.source || 'No source'} · ${lead.id}`"
      :title="lead.name"
      :subtitle="[lead.contactName, lead.contactEmail].filter(Boolean).join(' · ') || undefined"
      :stats="stats"
      :stages="PROCESS"
      :stage="lead.stage"
      :stage-note="daysInStage"
      :stage-readonly="isConverted"
      :closed-label="lead.stage === 'lost' ? 'This lead was lost.' : undefined"
      regarding-type="lead"
      :regarding-id="lead.id"
      :record-name="lead.name"
      :contact="{ name: lead.contactName, email: lead.contactEmail, phone: lead.contactPhone }"
      :interactions="lead.interactions"
      :documents="lead.documents"
      :upload="(file) => uploadDocument(lead!.id, file)"
      :remove-document="(docId) => removeDocument(lead!.id, docId)"
      :timeline="timeline"
      @stage="(value) => moveStage(value as LeadStage)"
      @reopen="moveStage('new')"
    >
      <template #actions>
        <Button variant="lime" :disabled="saving || !isDirty || !form.name.trim()" @click="save">
          Save
        </Button>
        <Button v-if="!isConverted" variant="ghost" @click="isQualifyOpen = true">
          Convert to client
        </Button>
        <Button v-else variant="ghost" as-child>
          <NuxtLink :to="`/clients/${lead.convertedClientId}`">
            Open client
          </NuxtLink>
        </Button>
        <Button v-if="lead.stage !== 'lost' && !isConverted" variant="ghost" @click="moveStage('lost')">
          Mark as lost
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
            <StaffAssigneePicker :model-value="lead.assignees.map(a => a.id)" :staff="activeStaff" @update:model-value="onAssigneesChange" />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="isDeleteOpen = true">
          Delete
        </Button>
      </template>

      <template #details>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <Label for="rec-name" class="text-[13px] font-semibold">Company / lead name</Label>
            <Input id="rec-name" v-model="form.name" />
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
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <Label for="rec-source" class="text-[13px] font-semibold">Source</Label>
            <Input id="rec-source" v-model="form.source" placeholder="e.g. Referral, Website" />
          </div>
        </div>
        <RecordExtraContacts
          :emails="lead.additionalEmails"
          :phones="lead.additionalPhones"
          :add-email="(v) => addContactEmail(lead!.id, v)"
          :remove-email="(eid) => removeContactEmail(lead!.id, eid)"
          :add-phone="(v) => addContactPhone(lead!.id, v)"
          :remove-phone="(pid) => removeContactPhone(lead!.id, pid)"
        />
        <div class="flex flex-col gap-1.5">
          <Label for="rec-notes" class="text-[13px] font-semibold">Notes</Label>
          <Textarea id="rec-notes" v-model="form.notes" rows="3" placeholder="What are they looking for?" />
        </div>
      </template>

      <template #key-card>
        <RecordCard title="Next step" tone="mist">
          <Textarea v-model="nextStep.text" rows="2" placeholder="What's the next action on this lead?" class="bg-card" aria-label="Next step" />
          <Label for="rec-key-at" class="text-[13px] font-semibold">Remind me</Label>
          <Input id="rec-key-at" v-model="nextStep.at" type="datetime-local" class="bg-card" />
          <Button class="self-start" @click="saveNextStep">
            Save next step
          </Button>
          <p v-if="lead.nextStepAt" class="m-0 text-xs">
            Due {{ dateLabel(lead.nextStepAt) }}
          </p>
        </RecordCard>
      </template>

      <Dialog v-model:open="isQualifyOpen">
        <DialogContent class="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Convert to client</DialogTitle>
            <DialogDescription>Canopy creates the client and links this lead's history, quotes and files to it.</DialogDescription>
          </DialogHeader>
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
              <span><b>Client</b> · {{ lead.name }}</span><span class="text-xs font-semibold text-muted-foreground">New</span>
            </div>
            <div v-if="lead.contactName" class="flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-3 text-sm">
              <span><b>Contact</b> · {{ lead.contactName }}</span><span class="text-xs font-semibold text-muted-foreground">New</span>
            </div>
          </div>
          <div v-if="clientMatches.length" class="rounded-xl bg-amber-100 px-3.5 py-3 text-sm text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
            <b>Possible duplicate:</b> {{ clientMatches.map(m => `${m.label} (${m.id}, same ${m.reason})`).join('; ') }}.
          </div>
          <div v-else class="rounded-xl bg-brand-mist px-3.5 py-3 text-sm text-brand-forest">
            <b>Duplicate check:</b> no matching client found.
          </div>
          <DialogFooter>
            <Button variant="outline" @click="isQualifyOpen = false">
              Cancel
            </Button>
            <Button variant="lime" :disabled="converting" @click="qualify">
              Convert &amp; open client
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog v-model:open="isDeleteOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {{ lead.name }}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the lead and its activity history.</AlertDialogDescription>
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
