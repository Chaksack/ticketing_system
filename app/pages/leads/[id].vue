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
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
    <p v-if="notFound" class="text-muted-foreground">
      This lead doesn't exist or was deleted. <NuxtLink to="/leads" class="underline">
        Back to leads
      </NuxtLink>
    </p>

    <template v-else-if="lead">
      <PageActions label="Lead actions">
        <Button variant="ghost" size="icon" as-child aria-label="Back to leads">
          <NuxtLink to="/leads">
            <Icon name="i-lucide-arrow-left" />
          </NuxtLink>
        </Button>
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
        <Button variant="ghost" as-child>
          <a href="#quotes">Create quote</a>
        </Button>
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="isDeleteOpen = true">
          Delete
        </Button>
      </PageActions>

      <RecordHeader :eyebrow="`Lead · ${lead.source || 'No source'} · ${lead.id}`" :title="lead.name" :subtitle="[lead.contactName, lead.contactEmail].filter(Boolean).join(' · ') || undefined" :stats="stats">
        <p v-if="lead.stage === 'lost'" class="m-0 flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          This lead was lost.
          <Button size="sm" variant="outline" @click="moveStage('new')">
            Reopen
          </Button>
        </p>
        <RecordStageBar v-else :stages="PROCESS" :current="lead.stage" label="Sales process" :note="daysInStage" :readonly="isConverted" @select="moveStage" />
      </RecordHeader>

      <div class="flex flex-wrap items-start gap-4">
        <RecordCard title="Contact" class="flex-[1_1_340px]">
          <div class="grid gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5 sm:col-span-2">
              <Label for="lead-name" class="text-[13px] font-semibold">Company / lead name</Label>
              <Input id="lead-name" v-model="form.name" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="lead-contact" class="text-[13px] font-semibold">Contact name</Label>
              <Input id="lead-contact" v-model="form.contactName" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="lead-source" class="text-[13px] font-semibold">Source</Label>
              <Input id="lead-source" v-model="form.source" placeholder="e.g. Referral, Website" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="lead-email" class="text-[13px] font-semibold">Email</Label>
              <Input id="lead-email" v-model="form.contactEmail" type="email" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="lead-phone" class="text-[13px] font-semibold">Phone</Label>
              <Input id="lead-phone" v-model="form.contactPhone" type="tel" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="lead-value" class="text-[13px] font-semibold">Estimated value</Label>
              <Input id="lead-value" v-model="form.estimatedValue" inputmode="decimal" />
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
            <Label for="lead-notes" class="text-[13px] font-semibold">Need / notes</Label>
            <Textarea id="lead-notes" v-model="form.notes" rows="3" placeholder="What are they looking for?" />
          </div>
        </RecordCard>

        <RecordCard title="Activity" class="flex-[1_1_340px]">
          <p v-if="!lead.activity.length" class="m-0 text-sm text-muted-foreground">
            No activity yet.
          </p>
          <ol class="m-0 flex list-none flex-col p-0">
            <li v-for="activity in lead.activity" :key="activity.id" class="border-b border-border py-3 last:border-0">
              <div class="flex justify-between gap-3">
                <b class="text-sm text-foreground">{{ activityLabel(activity) }}</b>
                <span class="shrink-0 text-xs text-muted-foreground">{{ when(activity.createdAt) }}</span>
              </div>
              <div v-if="activity.actorName" class="text-[13px] text-muted-foreground">
                {{ activity.actorName }}
              </div>
            </li>
            <li class="py-3">
              <div class="flex justify-between gap-3">
                <b class="text-sm text-foreground">Lead created</b>
                <span class="shrink-0 text-xs text-muted-foreground">{{ when(lead.createdAt) }}</span>
              </div>
              <div v-if="lead.source" class="text-[13px] text-muted-foreground">
                Source: {{ lead.source }}
              </div>
            </li>
          </ol>
        </RecordCard>

        <aside class="flex flex-[1_1_300px] flex-col gap-4">
          <RecordCard title="Next step" tone="mist">
            <Textarea v-model="nextStep.text" rows="2" placeholder="What's the next action on this lead?" class="bg-card" aria-label="Next step" />
            <Label for="lead-next-at" class="text-[13px] font-semibold">Remind me</Label>
            <Input id="lead-next-at" v-model="nextStep.at" type="datetime-local" class="bg-card" />
            <Button class="self-start" @click="saveNextStep">
              Save next step
            </Button>
          </RecordCard>
          <InsightsAiSuggestionCard regarding-type="lead" :regarding-id="lead.id" />
          <RecordDocumentsCard :documents="lead.documents" :upload="(file) => uploadDocument(lead!.id, file)" :remove="(docId) => removeDocument(lead!.id, docId)" />
        </aside>
      </div>

      <RecordCard>
        <InteractionsSection regarding-type="lead" :regarding-id="lead.id" :interactions="lead.interactions" />
      </RecordCard>

      <RecordCard id="quotes" class="scroll-mt-4">
        <QuotesSection regarding-type="lead" :regarding-id="lead.id" :record-name="lead.name" :contact-name="lead.contactName" :contact-email="lead.contactEmail" :contact-phone="lead.contactPhone" />
      </RecordCard>
    </template>

    <p v-else class="text-sm text-muted-foreground">
      Loading…
    </p>

    <Dialog v-model:open="isQualifyOpen">
      <DialogContent v-if="lead" class="rounded-[28px]">
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
          <AlertDialogTitle>Delete {{ lead?.name }}?</AlertDialogTitle>
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
  </div>
</template>
