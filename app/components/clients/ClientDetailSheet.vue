<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { Client, ClientActivity, ClientStage } from '~/types/client'
import type { Project, ProjectStatus } from '~/types/project'
import { toast } from 'vue-sonner'
import InvoiceCard from '~/components/invoices/InvoiceCard.vue'
import AmcContractCard from '~/components/projects/AmcContractCard.vue'
import { projectStatuses } from '~/components/projects/data'
import { stages } from './data'

const props = defineProps<{
  client: Client | null
}>()

const open = defineModel<boolean>('open', { default: false })
const router = useRouter()

const { updateClient, addContactEmail, removeContactEmail, addContactPhone, removeContactPhone, addContact, removeContact, uploadDocument, removeDocument } = useClients()
const { staff, fetchStaff } = useStaff()
const { projectsForClient, fetchProjects, addProject } = useProjects()
const { addInvoice } = useInvoices()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
  fetchProjects()
})

const clientProjects = computed(() => props.client ? projectsForClient(props.client.id) : [])

function projectStatusBadgeClass(status: ProjectStatus) {
  return projectStatuses.find(s => s.value === status)?.badgeClass
}

function projectStatusLabel(status: ProjectStatus) {
  return projectStatuses.find(s => s.value === status)?.label ?? status
}

function openProject(project: Project) {
  router.push(`/projects?open=${project.id}`)
}

const isAddProjectOpen = ref(false)
const newProject = reactive({ name: '', status: 'planned' as ProjectStatus })

async function onAddProject() {
  if (!props.client || !newProject.name.trim())
    return

  await addProject({ clientId: props.client.id, name: newProject.name.trim(), status: newProject.status })
  newProject.name = ''
  newProject.status = 'planned'
  isAddProjectOpen.value = false
  toast('Project created')
}

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const stage = computed(() => stages.find(s => s.value === props.client?.stage))

async function onStageChange(value: AcceptableValue) {
  if (!props.client || value === null)
    return

  await updateClient(props.client.id, { stage: value as ClientStage })
  toast('Stage updated', {
    description: `${props.client.name} is now ${stages.find(s => s.value === value)?.label}.`,
  })
}

async function onAssigneesChange(assigneeIds: string[]) {
  if (!props.client)
    return

  await updateClient(props.client.id, { assigneeIds })
}

const notesDraft = ref('')
watch(() => props.client?.id, () => {
  notesDraft.value = props.client?.notes ?? ''
}, { immediate: true })

async function saveNotes() {
  if (!props.client)
    return

  await updateClient(props.client.id, { notes: notesDraft.value })
  toast('Notes saved')
}

const nameDraft = ref('')
const contactNameDraft = ref('')
const contactEmailDraft = ref('')
const contactPhoneDraft = ref('')
const estimatedValueDraft = ref('')

watch(() => props.client?.id, () => {
  nameDraft.value = props.client?.name ?? ''
  contactNameDraft.value = props.client?.contactName ?? ''
  contactEmailDraft.value = props.client?.contactEmail ?? ''
  contactPhoneDraft.value = props.client?.contactPhone ?? ''
  estimatedValueDraft.value = props.client?.estimatedValue !== undefined ? String(props.client.estimatedValue) : ''
}, { immediate: true })

async function saveDetails() {
  if (!props.client || !nameDraft.value.trim())
    return

  await updateClient(props.client.id, {
    name: nameDraft.value.trim(),
    contactName: contactNameDraft.value.trim(),
    contactEmail: contactEmailDraft.value.trim(),
    contactPhone: contactPhoneDraft.value.trim(),
    estimatedValue: estimatedValueDraft.value.trim() ? Number(estimatedValueDraft.value.trim()) : null,
  })
  toast('Details saved')
}

const newEmail = ref('')
const newEmailLabel = ref('')
const newPhone = ref('')
const newPhoneLabel = ref('')

async function onAddEmail() {
  if (!props.client || !newEmail.value.trim())
    return

  await addContactEmail(props.client.id, { email: newEmail.value.trim(), label: newEmailLabel.value.trim() || undefined })
  newEmail.value = ''
  newEmailLabel.value = ''
}

async function onRemoveEmail(emailId: string) {
  if (!props.client)
    return
  await removeContactEmail(props.client.id, emailId)
}

async function onAddPhone() {
  if (!props.client || !newPhone.value.trim())
    return

  await addContactPhone(props.client.id, { phone: newPhone.value.trim(), label: newPhoneLabel.value.trim() || undefined })
  newPhone.value = ''
  newPhoneLabel.value = ''
}

async function onRemovePhone(phoneId: string) {
  if (!props.client)
    return
  await removeContactPhone(props.client.id, phoneId)
}

const newContactName = ref('')
const newContactTitle = ref('')
const newContactEmail = ref('')
const newContactPhone = ref('')
const newContactIsPrimary = ref(false)

async function onAddContact() {
  if (!props.client || !newContactName.value.trim())
    return

  await addContact(props.client.id, {
    name: newContactName.value.trim(),
    title: newContactTitle.value.trim() || undefined,
    email: newContactEmail.value.trim() || undefined,
    phone: newContactPhone.value.trim() || undefined,
    isPrimary: newContactIsPrimary.value,
  })
  newContactName.value = ''
  newContactTitle.value = ''
  newContactEmail.value = ''
  newContactPhone.value = ''
  newContactIsPrimary.value = false
}

async function onRemoveContact(contactId: string) {
  if (!props.client)
    return
  await removeContact(props.client.id, contactId)
}

const documentInput = ref<HTMLInputElement>()
const isUploadingDocument = ref(false)

function onUploadButtonClick() {
  documentInput.value?.click()
}

async function onDocumentChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!props.client || !file)
    return

  isUploadingDocument.value = true
  try {
    await uploadDocument(props.client.id, file)
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
  if (!props.client)
    return
  await removeDocument(props.client.id, docId)
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

function activityLabel(activity: ClientActivity) {
  const actor = activity.actorName ?? 'Someone'

  switch (activity.type) {
    case 'stage_changed':
      return `${actor} moved this client from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `${actor} assigned to ${activity.toValue}`
    case 'note_updated':
      return `${actor} updated the notes`
    case 'amc_cancelled':
      return `${actor} cancelled an AMC contract`
    case 'contact_added':
      return `${actor} added contact ${activity.toValue}`
    case 'contact_removed':
      return `${actor} removed contact ${activity.fromValue}`
    default:
      return activity.message ?? `${actor} updated this client`
  }
}

const isInvoiceFormOpen = ref(false)
const newInvoiceLineItems = ref<{ description: string, quantity: number, unitPrice: number }[]>([])
const newLineDescription = ref('')
const newLineQuantity = ref('1')
const newLineUnitPrice = ref('')
const newInvoiceCurrency = ref('GHS')
const newInvoiceTaxRate = ref('0')
const newInvoiceDiscount = ref('0')
const newInvoiceDueAt = ref('')
const newInvoiceProjectId = ref<string>('')

const newInvoiceSubtotal = computed(() => newInvoiceLineItems.value.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
const newInvoiceTotal = computed(() => {
  const taxAmount = newInvoiceSubtotal.value * (Number(newInvoiceTaxRate.value || 0) / 100)
  return Math.max(newInvoiceSubtotal.value + taxAmount - Number(newInvoiceDiscount.value || 0), 0)
})

function onAddInvoiceLine() {
  if (!newLineDescription.value.trim() || !newLineUnitPrice.value.trim())
    return
  newInvoiceLineItems.value = [...newInvoiceLineItems.value, {
    description: newLineDescription.value.trim(),
    quantity: Number(newLineQuantity.value) > 0 ? Number(newLineQuantity.value) : 1,
    unitPrice: Number(newLineUnitPrice.value),
  }]
  newLineDescription.value = ''
  newLineQuantity.value = '1'
  newLineUnitPrice.value = ''
}

function onRemoveInvoiceLine(index: number) {
  newInvoiceLineItems.value = newInvoiceLineItems.value.filter((_, i) => i !== index)
}

async function onCreateInvoice() {
  if (!props.client || !newInvoiceLineItems.value.length)
    return

  try {
    const result = await addInvoice(props.client.id, {
      lineItems: newInvoiceLineItems.value,
      currency: newInvoiceCurrency.value.trim() || 'GHS',
      taxRate: Number(newInvoiceTaxRate.value || 0),
      discount: Number(newInvoiceDiscount.value || 0),
      dueAt: newInvoiceDueAt.value || undefined,
      projectId: newInvoiceProjectId.value || undefined,
    })
    newInvoiceLineItems.value = []
    newInvoiceTaxRate.value = '0'
    newInvoiceDiscount.value = '0'
    newInvoiceDueAt.value = ''
    newInvoiceProjectId.value = ''
    isInvoiceFormOpen.value = false
    if ('pending' in result) {
      toast('Sent for approval', {
        description: 'This discount needs sign-off before the invoice is created.',
      })
    }
    else {
      toast('Invoice created')
    }
  }
  catch (error: any) {
    toast.error('Could not create invoice', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
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
    <SheetContent side="right" class="w-full sm:max-w-3xl p-0">
      <template v-if="client">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ client.id }}
          </SheetDescription>
          <SheetTitle>{{ client.name }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Select :model-value="client.stage" @update:model-value="onStageChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <component :is="stage?.icon" v-if="stage?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in stages" :key="s.value" :value="s.value">
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
            <StaffAssigneePicker :model-value="client.assignees.map(a => a.id)" :staff="activeStaff" @update:model-value="onAssigneesChange" />
          </div>
          <div class="text-sm text-muted-foreground pt-1 flex flex-col gap-0.5">
            <span v-if="client.contactName">{{ client.contactName }}</span>
            <span v-if="client.contactEmail">{{ client.contactEmail }}</span>
            <span v-if="client.contactPhone">{{ client.contactPhone }}</span>
          </div>
        </SheetHeader>

        <ScrollArea class="flex-1 min-h-0">
          <div class="flex flex-col gap-6 px-6 pt-4 pb-6">
            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Details
              </h4>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Client Name</Label>
                <Input v-model="nameDraft" placeholder="Company name" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Contact Name</Label>
                <Input v-model="contactNameDraft" placeholder="Jane Doe" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Primary Email</Label>
                  <Input v-model="contactEmailDraft" type="email" placeholder="jane@acme.com" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Primary Phone</Label>
                  <Input v-model="contactPhoneDraft" placeholder="Optional" />
                </div>
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Estimated Value</Label>
                <Input v-model="estimatedValueDraft" type="number" placeholder="Optional" />
              </div>
              <div class="flex justify-end">
                <Button size="sm" variant="outline" :disabled="!nameDraft.trim()" @click="saveDetails">
                  Save Details
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <h4 class="text-sm font-medium">
                Contacts
              </h4>
              <p class="text-xs text-muted-foreground -mt-1">
                Named people at this account — a procurement lead, a technical evaluator, and so on.
              </p>

              <div v-for="contact in client.contacts" :key="contact.id" class="flex items-center gap-2 rounded-md border p-2 text-sm">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="font-medium truncate">{{ contact.name }}</span>
                    <Badge v-if="contact.isPrimary" variant="outline" class="text-[10px] bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                      Primary
                    </Badge>
                    <Badge v-if="contact.title" variant="outline" class="text-[10px]">
                      {{ contact.title }}
                    </Badge>
                  </div>
                  <p class="text-xs text-muted-foreground truncate">
                    <span v-if="contact.email">{{ contact.email }}</span>
                    <span v-if="contact.email && contact.phone"> · </span>
                    <span v-if="contact.phone">{{ contact.phone }}</span>
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" class="size-6 shrink-0 text-muted-foreground" @click="onRemoveContact(contact.id)">
                  <Icon name="i-lucide-x" class="size-3" />
                </Button>
              </div>
              <p v-if="!client.contacts.length" class="text-xs text-muted-foreground">
                No named contacts yet.
              </p>

              <div class="flex flex-col gap-2 rounded-md border p-2">
                <div class="grid grid-cols-2 gap-2">
                  <Input v-model="newContactName" placeholder="Name" class="h-8 text-xs" />
                  <Input v-model="newContactTitle" placeholder="Title (optional)" class="h-8 text-xs" />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <Input v-model="newContactEmail" type="email" placeholder="Email (optional)" class="h-8 text-xs" />
                  <Input v-model="newContactPhone" placeholder="Phone (optional)" class="h-8 text-xs" />
                </div>
                <div class="flex items-center justify-between">
                  <label class="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Checkbox v-model="newContactIsPrimary" />
                    Make this the primary contact
                  </label>
                  <Button size="sm" variant="outline" :disabled="!newContactName.trim()" @click="onAddContact">
                    <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
                    Add Contact
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <h4 class="text-sm font-medium">
                Additional Contact Info
              </h4>
              <p class="text-xs text-muted-foreground -mt-1">
                Extra emails/phones for the same contact person (e.g. work + personal).
              </p>

              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Emails</Label>
                <div v-for="email in client.additionalEmails" :key="email.id" class="flex items-center gap-2 text-sm">
                  <span class="flex-1 truncate">{{ email.email }}</span>
                  <Badge v-if="email.label" variant="outline" class="text-[10px]">
                    {{ email.label }}
                  </Badge>
                  <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground" @click="onRemoveEmail(email.id)">
                    <Icon name="i-lucide-x" class="size-3" />
                  </Button>
                </div>
                <div class="flex gap-2">
                  <Input v-model="newEmail" type="email" placeholder="another@acme.com" class="flex-1" />
                  <Input v-model="newEmailLabel" placeholder="Label (optional)" class="w-32" />
                  <Button size="icon-sm" variant="outline" class="shrink-0" :disabled="!newEmail.trim()" @click="onAddEmail">
                    <Icon name="i-lucide-plus" class="size-3.5" />
                  </Button>
                </div>
              </div>

              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Phone Numbers</Label>
                <div v-for="phone in client.additionalPhones" :key="phone.id" class="flex items-center gap-2 text-sm">
                  <span class="flex-1 truncate">{{ phone.phone }}</span>
                  <Badge v-if="phone.label" variant="outline" class="text-[10px]">
                    {{ phone.label }}
                  </Badge>
                  <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground" @click="onRemovePhone(phone.id)">
                    <Icon name="i-lucide-x" class="size-3" />
                  </Button>
                </div>
                <div class="flex gap-2">
                  <Input v-model="newPhone" placeholder="+233 24 000 0000" class="flex-1" />
                  <Input v-model="newPhoneLabel" placeholder="Label (optional)" class="w-32" />
                  <Button size="icon-sm" variant="outline" class="shrink-0" :disabled="!newPhone.trim()" @click="onAddPhone">
                    <Icon name="i-lucide-plus" class="size-3.5" />
                  </Button>
                </div>
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
              <p v-if="!client.documents.length" class="text-sm text-muted-foreground">
                No documents uploaded yet.
              </p>
              <div v-for="document in client.documents" :key="document.id" class="flex items-center gap-2 rounded-md border p-2 text-sm">
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

            <InsightsAiSuggestionCard regarding-type="client" :regarding-id="client.id" />

            <Separator />

            <InteractionsSection regarding-type="client" :regarding-id="client.id" :interactions="client.interactions" />

            <Separator />

            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Notes
              </h4>
              <Textarea v-model="notesDraft" rows="3" placeholder="Notes about this client..." />
              <div class="flex justify-end">
                <Button size="sm" variant="outline" @click="saveNotes">
                  Save Notes
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium">
                  Projects
                </h4>
                <Popover v-model:open="isAddProjectOpen">
                  <PopoverTrigger as-child>
                    <Button size="sm" variant="outline" class="gap-1.5">
                      <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
                      New Project
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-[260px] flex flex-col gap-3" align="end">
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs">Name</Label>
                      <Input v-model="newProject.name" placeholder="Project name" class="h-8 text-xs" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs">Status</Label>
                      <Select v-model="newProject.status">
                        <SelectTrigger class="w-full h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="option in projectStatuses" :key="option.value" :value="option.value">
                            {{ option.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" :disabled="!newProject.name.trim()" @click="onAddProject">
                      Create
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>

              <p v-if="!clientProjects.length" class="text-sm text-muted-foreground">
                No projects yet.
              </p>

              <div
                v-for="project in clientProjects"
                :key="project.id"
                class="flex flex-col gap-1 rounded-md border p-3 cursor-pointer hover:bg-accent/50"
                @click="openProject(project)"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{{ project.name }}</span>
                  <Badge variant="outline" :class="projectStatusBadgeClass(project.status)">
                    {{ projectStatusLabel(project.status) }}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ project.contracts.length }} AMC contract{{ project.contracts.length === 1 ? '' : 's' }}
                </p>
              </div>
            </div>

            <template v-if="client.contracts.length">
              <Separator />

              <div class="flex flex-col gap-3">
                <h4 class="text-sm font-medium">
                  Legacy AMC Contracts
                </h4>
                <p class="text-xs text-muted-foreground -mt-1">
                  Assigned before Projects existed — not linked to any project.
                </p>
                <AmcContractCard v-for="contract in client.contracts" :key="contract.id" :contract="contract" />
              </div>
            </template>

            <Separator />

            <div class="flex flex-col gap-3">
              <h4 class="text-sm font-medium flex items-center justify-between">
                <span>Billing</span>
                <Button size="sm" variant="outline" @click="isInvoiceFormOpen = !isInvoiceFormOpen">
                  <Icon name="i-lucide-plus" class="mr-1.5 h-3.5 w-3.5" />
                  New Invoice
                </Button>
              </h4>

              <div v-if="client.balanceByCurrency.length" class="flex flex-wrap gap-2">
                <Badge v-for="row in client.balanceByCurrency" :key="row.currency" variant="outline" class="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30">
                  Owes {{ row.balance.toLocaleString() }} {{ row.currency }}
                </Badge>
              </div>
              <p v-else class="text-xs text-muted-foreground">
                No outstanding balance.
              </p>

              <div v-if="isInvoiceFormOpen" class="flex flex-col gap-2 rounded-md border p-2">
                <div v-for="(line, index) in newInvoiceLineItems" :key="index" class="flex items-center gap-2 rounded-md border p-1.5 text-xs">
                  <span class="flex-1 truncate">{{ line.description }}</span>
                  <span class="shrink-0 text-muted-foreground">{{ line.quantity }} × {{ line.unitPrice.toLocaleString() }}</span>
                  <span class="shrink-0 font-medium tabular-nums">{{ (line.quantity * line.unitPrice).toLocaleString() }}</span>
                  <Button size="icon-sm" variant="ghost" class="size-5 shrink-0" @click="onRemoveInvoiceLine(index)">
                    <Icon name="i-lucide-x" class="size-3" />
                  </Button>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <Input v-model="newLineDescription" placeholder="Line description" class="h-8 text-xs" />
                  <Input v-model="newLineQuantity" type="number" min="1" placeholder="Qty" class="h-8 text-xs" />
                  <Input v-model="newLineUnitPrice" type="number" min="0" step="0.01" placeholder="Unit price" class="h-8 text-xs" />
                </div>
                <div class="flex justify-end">
                  <Button size="sm" variant="outline" @click="onAddInvoiceLine">
                    <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
                    Add Line
                  </Button>
                </div>

                <div class="grid grid-cols-4 gap-2">
                  <Input v-model="newInvoiceCurrency" placeholder="Currency" class="h-8 text-xs" />
                  <Input v-model="newInvoiceTaxRate" type="number" min="0" step="0.1" placeholder="Tax %" class="h-8 text-xs" />
                  <Input v-model="newInvoiceDiscount" type="number" min="0" step="0.01" placeholder="Discount" class="h-8 text-xs" />
                  <Input v-model="newInvoiceDueAt" type="date" class="h-8 text-xs" />
                </div>
                <Select v-model="newInvoiceProjectId">
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue placeholder="Link a project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="project in client.projects" :key="project.id" :value="project.id">
                      {{ project.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div class="flex items-center justify-between pt-1">
                  <span class="text-xs text-muted-foreground">Total: {{ newInvoiceTotal.toLocaleString() }} {{ newInvoiceCurrency }}</span>
                  <Button size="sm" :disabled="!newInvoiceLineItems.length" @click="onCreateInvoice">
                    Create Invoice
                  </Button>
                </div>
              </div>

              <p v-if="!client.invoices.length" class="text-sm text-muted-foreground">
                No invoices yet.
              </p>
              <InvoiceCard v-for="invoice in client.invoices" :key="invoice.id" :invoice="invoice" :client-id="client.id" />
            </div>

            <Separator />

            <div class="flex flex-col gap-3 pb-6">
              <h4 class="text-sm font-medium">
                Activity
              </h4>
              <p v-if="!client.activity.length" class="text-sm text-muted-foreground">
                No activity yet.
              </p>
              <div v-for="activity in client.activity" :key="activity.id" class="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{{ activityLabel(activity) }}</span>
                <span>·</span>
                <span>{{ formatDateTime(activity.createdAt) }}</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
