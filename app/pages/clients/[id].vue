<script setup lang="ts">
import type { ClientActivity, ClientStage } from '~/types/client'
import type { FieldAsset } from '~/types/field'
import type { ProjectStatus } from '~/types/project'
import type { Ticket } from '~/types/ticket'
import { toast } from 'vue-sonner'
import { stages } from '~/components/clients/data'
import AmcContractCard from '~/components/projects/AmcContractCard.vue'
import { projectStatuses } from '~/components/projects/data'
import { parseAmountInput } from '~/lib/formNumbers'
import { formatProjectMoney } from '~/types/project'

// Client record ("Account record (360°)" in the Canopy design) — everything about the client, every team.
definePageMeta({ middleware: 'bd' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { hasApp } = useAuth()
const { clients, fetchClient, updateClient, removeClient, addContactEmail, removeContactEmail, addContactPhone, removeContactPhone, addContact, removeContact, uploadDocument, removeDocument } = useClients()
const { staff, fetchStaff } = useStaff()
const { projectsForClient, fetchProjects, addProject } = useProjects()

const client = computed(() => clients.value.find(c => c.id === id.value) ?? null)
const notFound = ref(false)
const tickets = ref<Ticket[]>([])
const assets = ref<FieldAsset[]>([])

onMounted(async () => {
  try {
    await fetchClient(id.value)
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
  }
  if (!staff.value.length)
    await fetchStaff()
  await fetchProjects()
  if (hasApp('service'))
    tickets.value = await fetchUntyped<{ tickets: Ticket[] }>('/api/tickets').then(r => r.tickets).catch(() => [])
  if (hasApp('field'))
    assets.value = await fetchUntyped<{ assets: FieldAsset[] }>('/api/field/assets', { query: { clientId: id.value } }).then(r => r.assets).catch(() => [])
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const clientProjects = computed(() => client.value ? projectsForClient(client.value.id) : [])

/** Tickets raised from any of this client's email addresses. */
const clientTickets = computed(() => {
  if (!client.value)
    return []
  const emails = new Set([client.value.contactEmail, ...client.value.additionalEmails.map(e => e.email), ...client.value.contacts.map(c => c.email)].filter(Boolean).map(e => e!.toLowerCase()))
  return tickets.value.filter(t => emails.has(t.requesterEmail.toLowerCase()))
})

const stageLabel = computed(() => stages.find(s => s.value === client.value?.stage)?.label ?? client.value?.stage)
const activeContracts = computed(() => client.value ? [...client.value.contracts, ...client.value.projects.flatMap(p => p.contracts)].filter(c => c.status === 'active').length : 0)
const amountDue = computed(() => {
  const byCurrency = new Map<string, number>()
  for (const project of clientProjects.value) {
    if (project.amountDue)
      byCurrency.set(project.currency, (byCurrency.get(project.currency) ?? 0) + project.amountDue)
  }
  return [...byCurrency].map(([currency, value]) => formatProjectMoney(currency as never, value, 0)).join(' + ') || '—'
})
const stats = computed(() => client.value
  ? [
      { label: 'Est. value', value: client.value.estimatedValue !== undefined ? client.value.estimatedValue.toLocaleString() : '—' },
      { label: 'Projects', value: String(clientProjects.value.length) },
      { label: 'Amount due', value: amountDue.value },
      { label: 'Owner', value: client.value.assignees.map(a => a.name).join(', ') || 'Unassigned' },
    ]
  : [])

const tab = ref('summary')
const extraTabs = computed(() => [
  { value: 'contacts', label: 'Contacts', count: client.value?.contacts.length },
  { value: 'projects', label: 'Projects', count: clientProjects.value.length },
  ...(hasApp('service') ? [{ value: 'tickets', label: 'Tickets', count: clientTickets.value.length }] : []),
  ...(hasApp('field') ? [{ value: 'assets', label: 'Assets', count: assets.value.length }] : []),
])
const PROCESS = stages.filter(s => s.value !== 'lost').map(s => ({ value: s.value as ClientStage, label: s.label }))
const daysInStage = computed(() => {
  if (!client.value)
    return undefined
  const lastMove = client.value.activity.find(a => a.type === 'stage_changed')?.createdAt ?? client.value.createdAt
  const days = Math.floor((Date.now() - new Date(lastMove).getTime()) / 86400000)
  return days < 1 ? 'Today' : `${days} d`
})
const allContracts = computed(() => client.value ? [...client.value.contracts, ...client.value.projects.flatMap(p => p.contracts)] : [])
const nextRenewal = computed(() => allContracts.value.filter(c => c.status === 'active').sort((a, b) => a.endDate.localeCompare(b.endDate))[0])
const primaryContact = computed(() => client.value?.contacts.find(c => c.isPrimary))

// ── Company form (Save in the toolbar) ────────────────────────────────────
const form = reactive({ name: '', contactName: '', contactEmail: '', contactPhone: '', estimatedValue: '', notes: '' })
function snapshot() {
  const c = client.value!
  return { name: c.name, contactName: c.contactName ?? '', contactEmail: c.contactEmail ?? '', contactPhone: c.contactPhone ?? '', estimatedValue: c.estimatedValue !== undefined ? String(c.estimatedValue) : '', notes: c.notes ?? '' }
}
watch(() => client.value?.id, () => client.value && Object.assign(form, snapshot()), { immediate: true })
const isDirty = computed(() => !!client.value && JSON.stringify(form) !== JSON.stringify(snapshot()))

const saving = ref(false)
async function save() {
  if (!client.value || !form.name.trim())
    return
  saving.value = true
  try {
    await updateClient(client.value.id, {
      name: form.name.trim(),
      contactName: form.contactName.trim(),
      contactEmail: form.contactEmail.trim(),
      contactPhone: form.contactPhone.trim(),
      estimatedValue: parseAmountInput(form.estimatedValue) ?? null,
      notes: form.notes,
    })
    toast('Client saved')
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    saving.value = false
  }
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

async function moveStage(stage: ClientStage) {
  if (client.value) {
    await updateClient(client.value.id, { stage })
    toast(`Stage set to ${stages.find(s => s.value === stage)?.label}`)
  }
}
async function onAssigneesChange(assigneeIds: string[]) {
  if (client.value)
    await updateClient(client.value.id, { assigneeIds })
}

// ── Contacts ──────────────────────────────────────────────────────────────
const contact = reactive({ name: '', title: '', email: '', phone: '', isPrimary: false })
async function onAddContact() {
  if (!client.value || !contact.name.trim())
    return
  await addContact(client.value.id, { name: contact.name.trim(), title: contact.title.trim() || undefined, email: contact.email.trim() || undefined, phone: contact.phone.trim() || undefined, isPrimary: contact.isPrimary })
  Object.assign(contact, { name: '', title: '', email: '', phone: '', isPrimary: false })
}

// ── Projects ──────────────────────────────────────────────────────────────
const isAddProjectOpen = ref(false)
const newProject = reactive({ name: '', status: 'planned' as ProjectStatus })
async function onAddProject() {
  if (!client.value || !newProject.name.trim())
    return
  await addProject({ clientId: client.value.id, name: newProject.name.trim(), status: newProject.status })
  Object.assign(newProject, { name: '', status: 'planned' })
  isAddProjectOpen.value = false
  tab.value = 'projects'
  toast('Project created')
}

// ── Delete (typed confirmation when there's real work attached) ───────────
const isDeleteOpen = ref(false)
const deleteConfirmName = ref('')
watch(isDeleteOpen, () => deleteConfirmName.value = '')
const deleteSummary = computed(() => {
  if (!client.value)
    return []
  const withMoney = client.value.projects.filter(p => p.totalCost > 0 || p.amountPaid > 0).length
  const lines = [
    [client.value.projects.length, 'project', withMoney ? ` (${withMoney} with recorded costs/payments)` : ''],
    [client.value.projects.reduce((sum, p) => sum + p.contracts.length, 0) + client.value.contracts.length, 'AMC contract', ''],
    [client.value.contacts.length, 'contact', ''],
    [client.value.documents.length, 'document', ''],
    [client.value.interactions.length, 'logged interaction', ''],
  ] as const
  return lines.filter(([count]) => count > 0).map(([count, noun, extra]) => `${count} ${noun}${count === 1 ? '' : 's'}${extra}`)
})
const needsTypedConfirm = computed(() => !!client.value?.projects.length)
const canConfirmDelete = computed(() => !needsTypedConfirm.value || deleteConfirmName.value.trim().toLowerCase() === client.value?.name.trim().toLowerCase())
const deleting = ref(false)
async function onDelete() {
  if (!client.value || !canConfirmDelete.value)
    return
  deleting.value = true
  try {
    const { name } = client.value
    await removeClient(client.value.id)
    toast('Client deleted', { description: `${name} was permanently removed.` })
    await navigateTo('/clients')
  }
  catch (error: any) {
    toast.error('Could not delete client', { description: error?.data?.statusMessage })
  }
  finally {
    deleting.value = false
  }
}

function activityLabel(activity: ClientActivity) {
  switch (activity.type) {
    case 'stage_changed':
      return `Moved from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `Assigned to ${activity.toValue}`
    case 'note_updated':
      return 'Notes updated'
    case 'amc_cancelled':
      return 'AMC contract cancelled'
    case 'contact_added':
      return `Contact added: ${activity.toValue}`
    case 'contact_removed':
      return `Contact removed: ${activity.fromValue}`
    default:
      return activity.message ?? 'Updated'
  }
}
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const dateLabel = (iso?: string) => iso ? new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
const timeline = computed(() => client.value
  ? [
      ...clientTickets.value.slice(0, 5).map(t => ({ id: `t-${t.id}`, label: `${t.id} ${t.subject}`, actor: `Service · ${t.status}`, at: t.createdAt })),
      ...client.value.activity.map(a => ({ id: a.id, label: activityLabel(a), actor: a.actorName, at: a.createdAt })),
      { id: 'created', label: 'Client created', actor: undefined, at: client.value.createdAt },
    ].sort((a, b) => b.at.localeCompare(a.at))
  : [])
const projectStatus = (status: ProjectStatus) => projectStatuses.find(s => s.value === status)
</script>

<template>
  <div class="w-full">
    <p v-if="notFound" class="text-muted-foreground">
      This client doesn't exist or was deleted. <NuxtLink to="/clients" class="underline">
        Back to clients
      </NuxtLink>
    </p>

    <RecordPage
      v-else-if="client"
      v-model:tab="tab"
      back-to="/clients"
      back-label="Back to clients"
      actions-label="Client actions"
      :eyebrow="`Client · ${stageLabel} · ${client.id}`"
      :title="client.name"
      :subtitle="[client.contactName, client.contactEmail].filter(Boolean).join(' · ') || undefined"
      :stats="stats"
      :stages="PROCESS"
      :stage="client.stage"
      :stage-note="daysInStage"
      :closed-label="client.stage === 'lost' ? 'This client was lost.' : undefined"
      regarding-type="client"
      :regarding-id="client.id"
      :record-name="client.name"
      :contact="{ name: primaryContact?.name ?? client.contactName, title: primaryContact?.title, email: primaryContact?.email ?? client.contactEmail, phone: primaryContact?.phone ?? client.contactPhone }"
      :interactions="client.interactions"
      :documents="client.documents"
      :upload="(file) => uploadDocument(client!.id, file)"
      :remove-document="(docId) => removeDocument(client!.id, docId)"
      :timeline="timeline"
      :extra-tabs="extraTabs"
      @stage="(value) => moveStage(value as ClientStage)"
      @reopen="moveStage('lead')"
    >
      <template #actions>
        <Button variant="lime" :disabled="saving || !isDirty || !form.name.trim()" @click="save">
          Save
        </Button>
        <Popover v-model:open="isAddProjectOpen">
          <PopoverTrigger as-child>
            <Button variant="ghost">
              New project
            </Button>
          </PopoverTrigger>
          <PopoverContent class="flex w-[260px] flex-col gap-3" align="start">
            <Input v-model="newProject.name" placeholder="Project name" aria-label="Project name" />
            <Select v-model="newProject.status">
              <SelectTrigger class="w-full" aria-label="Status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in projectStatuses" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" :disabled="!newProject.name.trim()" @click="onAddProject">
              Create project
            </Button>
          </PopoverContent>
        </Popover>
        <Button v-if="client.stage !== 'lost'" variant="ghost" @click="moveStage('lost')">
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
            <StaffAssigneePicker :model-value="client.assignees.map(a => a.id)" :staff="activeStaff" @update:model-value="onAssigneesChange" />
          </PopoverContent>
        </Popover>
        <Button variant="ghost" class="text-destructive hover:text-destructive" @click="isDeleteOpen = true">
          Delete
        </Button>
      </template>

      <template #details>
        <div class="grid gap-3 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5 sm:col-span-2">
            <Label for="rec-name" class="text-[13px] font-semibold">Client name</Label>
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
        </div>
        <RecordExtraContacts
          :emails="client.additionalEmails"
          :phones="client.additionalPhones"
          :add-email="(v) => addContactEmail(client!.id, v)"
          :remove-email="(eid) => removeContactEmail(client!.id, eid)"
          :add-phone="(v) => addContactPhone(client!.id, v)"
          :remove-phone="(pid) => removeContactPhone(client!.id, pid)"
        />
        <div class="flex flex-col gap-1.5">
          <Label for="rec-notes" class="text-[13px] font-semibold">Notes</Label>
          <Textarea id="rec-notes" v-model="form.notes" rows="3" />
        </div>
      </template>

      <template #key-card>
        <RecordCard title="Contracts" tone="mist">
          <div class="text-2xl font-black tracking-[-0.03em]">
            {{ activeContracts }} active AMC contract{{ activeContracts === 1 ? '' : 's' }}
          </div>
          <p class="m-0 text-sm">
            <template v-if="nextRenewal">
              Next renewal: {{ nextRenewal.planName ?? 'AMC' }} ends {{ dateLabel(nextRenewal.endDate) }}
            </template>
            <template v-else>
              No active contracts.
            </template>
          </p>
          <Button variant="outline" size="sm" class="self-start bg-card" @click="tab = 'projects'">
            See projects &amp; contracts
          </Button>
        </RecordCard>
      </template>

      <template #tab-contacts>
        <RecordCard title="Contacts">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="person in client.contacts" :key="person.id" class="flex items-start justify-between gap-2 rounded-2xl p-4" :class="person.isPrimary ? 'bg-brand-mist text-brand-forest' : 'bg-muted/60'">
              <div class="min-w-0">
                <b>{{ person.name }}</b>
                <div class="text-sm">
                  {{ [person.title, person.isPrimary ? 'Primary contact' : null].filter(Boolean).join(' · ') }}
                </div>
                <div class="truncate text-xs opacity-80">
                  {{ [person.email, person.phone].filter(Boolean).join(' · ') }}
                </div>
              </div>
              <Button size="icon-sm" variant="ghost" :aria-label="`Remove ${person.name}`" @click="removeContact(client.id, person.id)">
                <Icon name="i-lucide-x" />
              </Button>
            </div>
            <p v-if="!client.contacts.length" class="m-0 text-sm text-muted-foreground">
              No named contacts yet.
            </p>
          </div>
          <form class="grid gap-2 rounded-2xl border p-3 sm:grid-cols-2" @submit.prevent="onAddContact">
            <Input v-model="contact.name" placeholder="Name" aria-label="Contact name" />
            <Input v-model="contact.title" placeholder="Title, e.g. Procurement lead" aria-label="Contact title" />
            <Input v-model="contact.email" type="email" placeholder="Email" aria-label="Contact email" />
            <Input v-model="contact.phone" placeholder="Phone" aria-label="Contact phone" />
            <label class="flex items-center gap-2 text-sm">
              <Checkbox v-model="contact.isPrimary" /> Primary contact
            </label>
            <Button type="submit" class="justify-self-end" :disabled="!contact.name.trim()">
              Add contact
            </Button>
          </form>
        </RecordCard>
      </template>

      <template #tab-projects>
        <RecordCard title="Projects">
          <NuxtLink v-for="project in clientProjects" :key="project.id" :to="`/projects/${project.id}`" class="flex flex-wrap items-center justify-between gap-2 border-b border-border py-3 text-sm last:border-0 hover:underline">
            <span class="font-semibold text-foreground">{{ project.name }}</span>
            <span class="flex items-center gap-3 text-muted-foreground">
              <Badge variant="outline" :class="projectStatus(project.status)?.badgeClass">{{ projectStatus(project.status)?.label }}</Badge>
              {{ project.contractValue !== undefined ? formatProjectMoney(project.currency, project.contractValue, 0) : '' }}
              · {{ project.contracts.length }} AMC
            </span>
          </NuxtLink>
          <p v-if="!clientProjects.length" class="m-0 text-sm text-muted-foreground">
            No projects yet — use "New project" above.
          </p>
          <template v-if="client.contracts.length">
            <h3 class="m-0 mt-2 text-sm font-bold text-foreground">
              AMC contracts not linked to a project
            </h3>
            <AmcContractCard v-for="contractItem in client.contracts" :key="contractItem.id" :contract="contractItem" />
          </template>
        </RecordCard>
      </template>

      <template #tab-tickets>
        <RecordCard title="Tickets">
          <NuxtLink v-for="ticket in clientTickets" :key="ticket.id" :to="`/tickets/${ticket.id}`" class="flex flex-wrap justify-between gap-2 border-b border-border py-3 text-sm last:border-0 hover:underline">
            <span class="font-semibold text-foreground">{{ ticket.id }} · {{ ticket.subject }}</span>
            <span class="text-muted-foreground">{{ ticket.status }} · {{ ticket.priority }} · {{ when(ticket.createdAt) }}</span>
          </NuxtLink>
          <p v-if="!clientTickets.length" class="m-0 text-sm text-muted-foreground">
            No tickets from this client's email addresses.
          </p>
        </RecordCard>
      </template>

      <template #tab-assets>
        <RecordCard title="Assets">
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="asset in assets" :key="asset.id" class="rounded-2xl bg-muted/60 p-4">
              <b class="text-foreground">{{ asset.name }}</b>
              <div class="text-sm text-muted-foreground">
                {{ [asset.model, asset.serial, asset.location].filter(Boolean).join(' · ') || 'No details' }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ asset.workOrderCount }} job{{ asset.workOrderCount === 1 ? '' : 's' }}<template v-if="asset.lastServicedAt">
                  · last serviced {{ when(asset.lastServicedAt) }}
                </template>
              </div>
            </div>
          </div>
          <p v-if="!assets.length" class="m-0 text-sm text-muted-foreground">
            No assets recorded. <NuxtLink to="/field/assets" class="underline">
              Add them in Field Service
            </NuxtLink>.
          </p>
        </RecordCard>
      </template>

      <AlertDialog v-model:open="isDeleteOpen">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {{ client.name }}?</AlertDialogTitle>
            <AlertDialogDescription as="div" class="flex flex-col gap-2">
              <p>This permanently deletes the client and everything that belongs to it:</p>
              <ul v-if="deleteSummary.length" class="list-disc pl-5">
                <li v-for="line in deleteSummary" :key="line">
                  {{ line }}
                </li>
              </ul>
              <p>Tasks, calendar events and the lead/tender it was converted from are kept, just unlinked. This can't be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div v-if="needsTypedConfirm" class="flex flex-col gap-1.5">
            <Label for="c-confirm" class="text-xs">Type <b>{{ client.name }}</b> to confirm</Label>
            <Input id="c-confirm" v-model="deleteConfirmName" :placeholder="client.name" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" :disabled="!canConfirmDelete || deleting" @click="onDelete">
              {{ deleting ? 'Deleting…' : 'Delete client' }}
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
