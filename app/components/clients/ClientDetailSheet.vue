<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { Client, ClientActivity, ClientStage } from '~/types/client'
import type { Project, ProjectStatus } from '~/types/project'
import { toast } from 'vue-sonner'
import AmcContractCard from '~/components/projects/AmcContractCard.vue'
import { projectStatuses } from '~/components/projects/data'
import { stages } from './data'

const props = defineProps<{
  client: Client | null
}>()

const open = defineModel<boolean>('open', { default: false })
const router = useRouter()

const { updateClient, addContactEmail, removeContactEmail, addContactPhone, removeContactPhone } = useClients()
const { staff, fetchStaff } = useStaff()
const { projectsForClient, fetchProjects, addProject } = useProjects()

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

watch(() => props.client?.id, () => {
  nameDraft.value = props.client?.name ?? ''
  contactNameDraft.value = props.client?.contactName ?? ''
  contactEmailDraft.value = props.client?.contactEmail ?? ''
  contactPhoneDraft.value = props.client?.contactPhone ?? ''
}, { immediate: true })

async function saveDetails() {
  if (!props.client || !nameDraft.value.trim())
    return

  await updateClient(props.client.id, {
    name: nameDraft.value.trim(),
    contactName: contactNameDraft.value.trim(),
    contactEmail: contactEmailDraft.value.trim(),
    contactPhone: contactPhoneDraft.value.trim(),
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
    default:
      return activity.message ?? `${actor} updated this client`
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
              <div class="flex justify-end">
                <Button size="sm" variant="outline" :disabled="!nameDraft.trim()" @click="saveDetails">
                  Save Details
                </Button>
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
