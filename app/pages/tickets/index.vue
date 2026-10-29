<script setup lang="ts">
import type { Ticket } from '~/types/ticket'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { columns } from '@/components/tickets/components/columns'
import DataTable from '@/components/tickets/components/DataTable.vue'
import { priorities, statuses } from '@/components/tickets/data/data'
import { isValidPhone } from '~/lib/phone'

definePageMeta({
  middleware: 'agent',
})

const { tickets, fetchTickets, addTicket } = useTickets()
const { staff, fetchStaff } = useStaff()
const { clients, projects, fetchDirectory } = useCustomerDirectory()
const route = useRoute()

// Who the new ticket is for (optional). Left blank, it's matched by the requester's email.
const newClientId = ref('none')
const newProjectId = ref('none')
const newClientProjects = computed(() => projects.value.filter(p => p.clientId === newClientId.value))
watch(newClientId, () => newProjectId.value = 'none')

onMounted(async () => {
  await Promise.all([fetchTickets(), fetchStaff()])
})

const { currentUser, currentOrg } = useAuth()
const portalPath = computed(() => currentOrg.value && !currentOrg.value.isHome ? `/portal/${currentOrg.value.slug}` : '/portal')

const VIEWS = [
  { value: 'all', label: 'All tickets' },
  { value: 'mine', label: 'Assigned to me' },
  { value: 'unassigned', label: 'Unassigned' },
] as const
const view = ref<string>('all')

type StatusFilter = 'all' | Ticket['status']
const statusFilter = ref<StatusFilter>('all')

const inView = computed(() => tickets.value.filter(ticket =>
  view.value === 'mine'
    ? ticket.assigneeId === currentUser.value?.id
    : view.value === 'unassigned' ? !ticket.assigneeId : true,
))
const statusTabs = computed(() => ([
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
] as const).map(tab => ({ ...tab, count: inView.value.filter(ticket => tab.value === 'all' || ticket.status === tab.value).length })))
const visibleTickets = computed(() => inView.value.filter(ticket => statusFilter.value === 'all' || ticket.status === statusFilter.value))

function exportTickets() {
  downloadCsv('tickets.csv', ['ID', 'Subject', 'Requester', 'Email', 'Phone', 'Category', 'Priority', 'Status', 'Assignee', 'Created', 'Resolved'], visibleTickets.value.map(ticket => [
    ticket.id,
    ticket.subject,
    ticket.requester,
    ticket.requesterEmail,
    ticket.requesterPhone,
    ticket.category,
    priorities.find(p => p.value === ticket.priority)?.label ?? ticket.priority,
    statuses.find(st => st.value === ticket.status)?.label ?? ticket.status,
    ticket.assigneeName,
    ticket.createdAt?.slice(0, 10),
    ticket.resolvedAt?.slice(0, 10),
  ]))
}

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

function openTicket(ticket: Ticket) {
  navigateTo(`/tickets/${ticket.id}`)
}

// Older links (notifications, search, emails) use /tickets?open=<id>.
watch(() => route.query.open, (openId) => {
  if (typeof openId === 'string')
    navigateTo(`/tickets/${openId}`, { replace: true })
}, { immediate: true })

const isReportOpen = ref(false)

const reportFormSchema = toTypedSchema(z.object({
  subject: z.string().min(3, { message: 'Subject must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Please provide more detail (at least 10 characters).' }),
  requester: z.string().min(2, { message: 'Requester name is required.' }),
  requesterEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  requesterPhone: z.string().optional().refine(value => !value?.trim() || isValidPhone(value), { message: 'Please enter a valid phone number.' }),
  category: z.string().min(2, { message: 'Category is required.' }),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], { required_error: 'Please select a priority.' }),
  assigneeId: z.string().optional(),
}))

const { handleSubmit, resetForm, setFieldValue } = useForm({
  validationSchema: reportFormSchema,
  initialValues: { subject: '', description: '', requester: '', requesterEmail: '', requesterPhone: '', category: '', priority: 'medium', assigneeId: undefined },
})

watch(() => isReportOpen.value, async (open) => {
  if (open)
    await fetchDirectory().catch(() => {})
})

onMounted(async () => {
  if (route.query.new !== '1')
    return
  if (typeof route.query.clientId === 'string') {
    await fetchClients().catch(() => {})
    await fetchProjects().catch(() => {})
    newClientId.value = route.query.clientId
    await nextTick()
    if (typeof route.query.projectId === 'string')
      newProjectId.value = route.query.projectId
  }
  if (typeof route.query.requester === 'string')
    setFieldValue('requester', route.query.requester)
  if (typeof route.query.email === 'string')
    setFieldValue('requesterEmail', route.query.email)
  isReportOpen.value = true
})

const onReportSubmit = handleSubmit(async (values) => {
  try {
    const ticket = await addTicket({ ...values, requesterPhone: values.requesterPhone?.trim() || undefined, assigneeId: values.assigneeId || undefined, clientId: newClientId.value === 'none' ? undefined : newClientId.value, projectId: newProjectId.value === 'none' ? undefined : newProjectId.value })
    resetForm()
    newClientId.value = 'none'
    isReportOpen.value = false
    toast('Ticket reported', {
      description: `${ticket.id} was created and on-call staff have been paged.`,
    })
  }
  catch (error: any) {
    toast.error('Could not report ticket', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <PageActions label="Ticket actions">
      <Button variant="lime" @click="isReportOpen = true">
        <Icon name="i-lucide-plus" />
        New ticket
      </Button>
      <Button variant="ghost" :disabled="!visibleTickets.length" @click="exportTickets">
        <Icon name="i-lucide-download" />
        Export
      </Button>
      <Button variant="ghost" as-child>
        <a :href="portalPath" target="_blank" rel="noopener">
          <Icon name="i-lucide-external-link" />
          Customer portal
        </a>
      </Button>
    </PageActions>

    <PageTitle v-model:view="view" title="Tickets" :views="VIEWS">
      <template #aside>
        <PageSegmentedTabs v-model="statusFilter" label="Status" :options="statusTabs" />
      </template>
    </PageTitle>

    <Dialog v-model:open="isReportOpen">
      <DialogContent class="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report a Ticket</DialogTitle>
          <DialogDescription>
            On-call staff will be paged automatically once this ticket is submitted.
          </DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-4" @submit="onReportSubmit">
          <FormField v-slot="{ componentField }" name="subject">
            <FormItem>
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Short summary of the issue" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="description">
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="Describe the issue in detail" rows="4" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="requester">
            <FormItem>
              <FormLabel>Requester</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Who is reporting this?" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="requesterEmail">
            <FormItem>
              <FormLabel>Requester Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="requester@example.com" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="requesterPhone">
            <FormItem>
              <FormLabel>Requester Phone (optional)</FormLabel>
              <FormControl>
                <Input type="tel" inputmode="tel" placeholder="+233 24 123 4567" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="category">
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Input type="text" placeholder="e.g. Billing, Bug, Account" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="priority">
            <FormItem>
              <FormLabel>Priority</FormLabel>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="Select a priority" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem v-for="option in priorities" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="new-ticket-client">Client (optional)</Label>
              <Select v-model="newClientId">
                <SelectTrigger id="new-ticket-client" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    Match by email
                  </SelectItem>
                  <SelectItem v-for="c in clients" :key="c.id" :value="c.id">
                    {{ c.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-2">
              <Label for="new-ticket-project">Project (optional)</Label>
              <Select v-model="newProjectId" :disabled="newClientId === 'none'">
                <SelectTrigger id="new-ticket-project" class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {{ newClientProjects.length ? 'Pick automatically' : 'No projects' }}
                  </SelectItem>
                  <SelectItem v-for="p in newClientProjects" :key="p.id" :value="p.id">
                    {{ p.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <FormField v-slot="{ componentField }" name="assigneeId">
            <FormItem>
              <FormLabel>Assignee (optional)</FormLabel>
              <Select v-bind="componentField">
                <FormControl>
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="Leave unassigned" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
                    {{ member.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <DialogFooter>
            <Button type="submit">
              Report Ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <DataTable :data="visibleTickets" :columns="columns" @select="openTicket" />
  </div>
</template>
