<script setup lang="ts">
import type { HqRole, StaffMember, StaffRole } from '~/types/staff'
import { toast } from 'vue-sonner'
import { statusBadgeClass } from '~/components/admin/data'
import { HQ_ROLE_OPTIONS } from '~/types/staff'

// Canopy HQ → Team & access: add Canopy's own people as HQ admins, Care agents (assigned to
// client companies) or workspace-only staff, and change that later.
definePageMeta({ middleware: 'platform' })

interface Engagement { id: string, orgName: string, stage: string, agentIds: string[] }
type Access = HqRole | 'none'

const { currentUser } = useAuth()
const staff = ref<StaffMember[] | null>(null)
const engagements = ref<Engagement[]>([])

async function load() {
  const data = await fetchUntyped<{ staff: StaffMember[], engagements: Engagement[] }>('/api/hq/team')
  staff.value = data.staff
  engagements.value = data.engagements
}
onMounted(load)

const ROLE_OPTIONS: { value: StaffRole, label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Support agent' },
  { value: 'bd', label: 'BD Executive' },
  { value: 'sm', label: 'Sales & Marketing Exec' },
  { value: 'finance', label: 'Finance Executive' },
  { value: 'engineer', label: 'Engineer' },
  { value: 'engineering_coordinator', label: 'Engineering Coordinator' },
  { value: 'engineering_lead', label: 'Engineering Lead' },
]
const roleLabel = (role: StaffRole) => ROLE_OPTIONS.find(option => option.value === role)?.label ?? role
const accessLabel = (access?: HqRole) => HQ_ROLE_OPTIONS.find(option => option.value === (access ?? 'none'))!.label
const clientsFor = (member: StaffMember) => engagements.value.filter(e => e.agentIds.includes(member.id))

// ── Filters ─────────────────────────────────────────────────────────────────
const accessFilter = ref<'all' | Access>('all')
const search = ref('')
const accessTabs = computed(() => ([
  { value: 'all', label: 'Everyone' },
  { value: 'admin', label: 'HQ admins' },
  { value: 'agent', label: 'Care agents' },
  { value: 'none', label: 'Workspace only' },
] as const).map(tab => ({ ...tab, count: (staff.value ?? []).filter(m => tab.value === 'all' || (m.hqRole ?? 'none') === tab.value).length })))
const visible = computed(() => (staff.value ?? []).filter((member) => {
  if (accessFilter.value !== 'all' && (member.hqRole ?? 'none') !== accessFilter.value)
    return false
  const q = search.value.trim().toLowerCase()
  return !q || member.name.toLowerCase().includes(q) || member.email.toLowerCase().includes(q)
}))

// ── Add / edit ──────────────────────────────────────────────────────────────
const dialogOpen = ref(false)
const editing = ref<StaffMember | null>(null)
const form = reactive({ name: '', email: '', access: 'agent' as Access, roles: [] as StaffRole[], engagementIds: [] as string[] })
const saving = ref(false)
/** Show what's missing only after they try to save. */
const tried = ref(false)

function openAdd(access: Access = 'agent') {
  editing.value = null
  Object.assign(form, { name: '', email: '', access, roles: access === 'none' ? ['agent'] : [], engagementIds: [] })
  tried.value = false
  dialogOpen.value = true
}
function openEdit(member: StaffMember) {
  editing.value = member
  Object.assign(form, { name: member.name, email: member.email, access: member.hqRole ?? 'none', roles: [...member.roles], engagementIds: clientsFor(member).map(e => e.id) })
  tried.value = false
  dialogOpen.value = true
}
function toggle<T>(list: T[], value: T) {
  const index = list.indexOf(value)
  if (index === -1)
    list.push(value)
  else
    list.splice(index, 1)
}

const formError = computed(() => {
  if (!editing.value && (!form.name.trim() || !/^\S[^\s@]*@\S[^\s.]*\.\S+$/.test(form.email.trim())))
    return 'Enter a name and a valid email.'
  if (form.access === 'none' && !form.roles.length)
    return 'Workspace-only people need at least one workspace role.'
  return ''
})

async function save() {
  tried.value = true
  if (formError.value)
    return
  saving.value = true
  const body = { hqRole: form.access, roles: form.roles, engagementIds: form.access === 'agent' ? form.engagementIds : [] }
  try {
    let saved: StaffMember
    if (editing.value) {
      saved = (await fetchUntyped<{ staff: StaffMember }>(`/api/hq/team/${editing.value.id}`, { method: 'PATCH', body })).staff
      toast(`${editing.value.name} updated`)
    }
    else {
      const { staff: added, emailSent } = await fetchUntyped<{ staff: StaffMember, emailSent: boolean }>('/api/hq/team', { method: 'POST', body: { ...body, name: form.name, email: form.email } })
      saved = added
      toast(`${form.name} added as ${accessLabel(form.access === 'none' ? undefined : form.access).toLowerCase()}`, {
        description: emailSent ? `An invite was sent to ${form.email}.` : 'The invite email could not be sent — check the Gmail settings in .env.',
      })
    }
    // Show the change straight away; the reload below catches anything else.
    const list = staff.value ?? []
    const index = list.findIndex(member => member.id === saved.id)
    staff.value = index === -1 ? [saved, ...list] : list.map(member => member.id === saved.id ? saved : member)
    for (const engagement of engagements.value) {
      const others = engagement.agentIds.filter(id => id !== saved.id)
      engagement.agentIds = body.engagementIds.includes(engagement.id) ? [...others, saved.id] : others
    }
    dialogOpen.value = false
    void load()
  }
  catch (error: any) {
    toast.error('Not saved', { description: error?.data?.statusMessage })
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="Team actions">
      <Button variant="lime" @click="openAdd('agent')">
        <Icon name="i-lucide-headset" />
        Add Care agent
      </Button>
      <Button variant="ghost" @click="openAdd('admin')">
        <Icon name="i-lucide-shield-check" />
        Add HQ admin
      </Button>
      <Button variant="ghost" @click="openAdd('none')">
        <Icon name="i-lucide-briefcase-business" />
        Add workspace staff
      </Button>
    </PageActions>

    <PageTitle title="Team & access" description="Canopy's own people. Give each one HQ access, Care agent access, or just the Canopy workspace.">
      <template #aside>
        <PageSegmentedTabs v-model="accessFilter" label="Access" :options="accessTabs" />
      </template>
    </PageTitle>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="search" placeholder="Find a person…" class="pl-9" aria-label="Find a person" />
    </div>

    <div class="overflow-x-auto rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Person</TableHead>
            <TableHead>Canopy HQ</TableHead>
            <TableHead>Care clients</TableHead>
            <TableHead>Workspace roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="w-0">
              <span class="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!staff">
            <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!visible.length">
            <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
              No one matches.
            </TableCell>
          </TableRow>
          <TableRow v-for="member in visible" :key="member.id" class="cursor-pointer" @click="openEdit(member)">
            <TableCell>
              <div class="font-semibold text-foreground">
                {{ member.name }}<span v-if="member.id === currentUser?.id" class="ml-1.5 text-xs font-normal text-muted-foreground">(you)</span>
              </div>
              <div class="text-xs text-muted-foreground">
                {{ member.email }}
              </div>
            </TableCell>
            <TableCell>
              <span
                class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
                :class="member.hqRole === 'admin' ? 'bg-brand-forest text-brand-lime' : member.hqRole === 'agent' ? 'bg-brand-lime text-brand-forest' : 'bg-muted text-muted-foreground'"
              >
                <Icon :name="member.hqRole === 'admin' ? 'i-lucide-shield-check' : member.hqRole === 'agent' ? 'i-lucide-headset' : 'i-lucide-minus'" class="size-3.5" />
                {{ accessLabel(member.hqRole) }}
              </span>
            </TableCell>
            <TableCell class="max-w-[16rem] text-sm text-muted-foreground">
              <template v-if="member.hqRole === 'admin'">
                All clients
              </template>
              <template v-else-if="member.hqRole === 'agent'">
                {{ clientsFor(member).map(e => e.orgName).join(', ') || 'Not assigned yet' }}
              </template>
              <template v-else>
                —
              </template>
            </TableCell>
            <TableCell class="max-w-[16rem] text-sm text-muted-foreground">
              {{ member.roles.map(roleLabel).join(', ') || 'None (HQ only)' }}
            </TableCell>
            <TableCell>
              <Badge variant="outline" class="capitalize" :class="statusBadgeClass[member.status]">
                {{ member.status }}
              </Badge>
            </TableCell>
            <TableCell>
              <Button variant="ghost" size="icon-sm" :aria-label="`Edit ${member.name}`" @click.stop="openEdit(member)">
                <Icon name="i-lucide-pencil" />
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="dialogOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{{ editing ? `Access for ${editing.name}` : 'Add a person' }}</DialogTitle>
          <DialogDescription>
            {{ editing ? editing.email : 'They get an email invite to set their password.' }}
          </DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-5" @submit.prevent="save">
          <div v-if="!editing" class="grid gap-3 sm:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <Label for="team-name">Name</Label>
              <Input id="team-name" v-model="form.name" autocomplete="off" placeholder="Jane Doe" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="team-email">Email</Label>
              <Input id="team-email" v-model="form.email" type="email" autocomplete="off" placeholder="jane@canopy.com" />
            </div>
          </div>

          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-2 text-sm font-semibold">
              Canopy HQ access
            </legend>
            <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Canopy HQ access">
              <button
                v-for="option in HQ_ROLE_OPTIONS"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="form.access === option.value"
                class="flex flex-col gap-1 rounded-2xl p-3 text-left text-sm"
                :class="form.access === option.value ? 'bg-brand-mist ring-2 ring-brand-forest dark:bg-brand-spruce' : 'ring-1 ring-black/10 hover:bg-muted dark:ring-white/10'"
                @click="form.access = option.value"
              >
                <span class="font-semibold text-foreground">{{ option.label }}</span>
                <span class="text-xs text-muted-foreground">{{ option.description }}</span>
              </button>
            </div>
          </fieldset>

          <fieldset v-if="form.access === 'agent'" class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-1 text-sm font-semibold">
              Care clients they answer for
            </legend>
            <label v-for="engagement in engagements" :key="engagement.id" class="flex items-center gap-2 text-sm">
              <Checkbox :model-value="form.engagementIds.includes(engagement.id)" @update:model-value="toggle(form.engagementIds, engagement.id)" />
              {{ engagement.orgName }}
              <span class="text-xs capitalize text-muted-foreground">· {{ engagement.stage }}</span>
            </label>
            <p v-if="!engagements.length" class="m-0 text-sm text-muted-foreground">
              No Care engagements yet — set one up in Canopy Care → Engagements.
            </p>
          </fieldset>

          <fieldset class="m-0 flex flex-col gap-2 border-0 p-0">
            <legend class="mb-1 text-sm font-semibold">
              Canopy workspace roles
              <span class="font-normal text-muted-foreground">{{ form.access === 'none' ? '' : '(optional)' }}</span>
            </legend>
            <div class="grid gap-2 sm:grid-cols-2">
              <label v-for="option in ROLE_OPTIONS" :key="option.value" class="flex items-center gap-2 text-sm">
                <Checkbox :model-value="form.roles.includes(option.value)" @update:model-value="toggle(form.roles, option.value)" />
                {{ option.label }}
              </label>
            </div>
            <p class="m-0 text-xs text-muted-foreground">
              Roles in Canopy's own CRM (sales, leads, support). Leave empty for HQ-only people.
            </p>
          </fieldset>

          <p v-if="tried && formError" class="m-0 text-sm text-destructive" role="alert">
            {{ formError }}
          </p>
          <DialogFooter>
            <Button type="button" variant="ghost" @click="dialogOpen = false">
              Cancel
            </Button>
            <Button type="submit" variant="lime" :disabled="saving">
              {{ editing ? 'Save access' : 'Add and invite' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
