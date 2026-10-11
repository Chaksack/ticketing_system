<script setup lang="ts">
import type { Client } from '~/types/client'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import ClientDetailSheet from '~/components/clients/ClientDetailSheet.vue'
import { columns } from '~/components/clients/components/columns'
import DataTableToolbar from '~/components/clients/components/DataTableToolbar.vue'
import { stages } from '~/components/clients/data'
import DataTable from '~/components/data-table/DataTable.vue'

definePageMeta({
  middleware: 'bd',
})

const { clients, fetchClients, fetchClient, addClient } = useClients()
const { staff, fetchStaff } = useStaff()
const route = useRoute()

const viewScope = ref<'all' | 'team'>('all')

onMounted(async () => {
  await Promise.all([fetchClients(), fetchStaff()])
})

watch(viewScope, scope => fetchClients(scope === 'team' ? { scope: 'team' } : undefined))

const VIEWS = [
  { value: 'all', label: 'All clients' },
  { value: 'team', label: 'My team\'s clients' },
] as const

type StageFilter = 'all' | 'prospect' | 'active' | 'lost'
const stageFilter = ref<StageFilter>('all')
const PROSPECT_STAGES = new Set(['lead', 'contacted', 'proposal', 'negotiation'])
function matchesStage(client: Client, filter: StageFilter) {
  return filter === 'all' || (filter === 'prospect' ? PROSPECT_STAGES.has(client.stage) : client.stage === filter)
}
const stageTabs = computed(() => ([
  { value: 'all', label: 'All' },
  { value: 'prospect', label: 'Prospects' },
  { value: 'active', label: 'Active' },
  { value: 'lost', label: 'Lost' },
] as const).map(tab => ({ ...tab, count: clients.value.filter(client => matchesStage(client, tab.value)).length })))
const visibleItems = computed(() => clients.value.filter(client => matchesStage(client, stageFilter.value)))

function exportList() {
  downloadCsv('clients.csv', ['ID', 'Name', 'Contact', 'Email', 'Phone', 'Stage', 'Estimated value', 'Assignees', 'Created'], visibleItems.value.map(client => [
    client.id,
    client.name,
    client.contactName,
    client.contactEmail,
    client.contactPhone,
    stages.find(stage => stage.value === client.stage)?.label ?? client.stage,
    client.estimatedValue,
    client.assignees.map(a => a.name).join('; '),
    client.createdAt?.slice(0, 10),
  ]))
}

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

const isDetailOpen = ref(false)
const selectedClientId = ref<string | null>(null)
const selectedClient = computed(() => clients.value.find(c => c.id === selectedClientId.value) ?? null)

async function openClient(client: Client) {
  selectedClientId.value = client.id
  isDetailOpen.value = true
  await fetchClient(client.id)
}

watch(() => route.query.open, async (openId) => {
  if (typeof openId === 'string')
    await openClient({ id: openId } as Client)
}, { immediate: true })

const isAddOpen = ref(false)

const clientFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  contactName: z.string().optional(),
  contactEmail: z.string().email({ message: 'Please enter a valid email address.' }).optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  stage: z.enum(['lead', 'contacted', 'proposal', 'negotiation', 'active', 'lost']),
  assigneeIds: z.array(z.string()).optional(),
}))

const { handleSubmit, resetForm, values } = useForm({
  validationSchema: clientFormSchema,
  initialValues: { name: '', contactName: '', contactEmail: '', contactPhone: '', stage: 'lead', assigneeIds: [] },
})

const { matches: duplicateMatches, blockingMatch: blockingDuplicate, check: checkDuplicate, reset: resetDuplicateCheck } = useDuplicateCheck('clients')

watch([() => values.name, () => values.contactEmail, () => values.contactPhone], () => {
  checkDuplicate({ name: values.name, email: values.contactEmail, phone: values.contactPhone })
})

const onSubmit = handleSubmit(async (values) => {
  try {
    const client = await addClient(values)
    resetForm()
    resetDuplicateCheck()
    isAddOpen.value = false
    toast('Client added', {
      description: `${client.name} was added to the pipeline.`,
    })
  }
  catch (error: any) {
    toast.error('Could not add client', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <PageActions label="Clients actions">
      <Button variant="lime" @click="isAddOpen = true">
        <Icon name="i-lucide-plus" />
        New client
      </Button>
      <Button variant="ghost" :disabled="!visibleItems.length" @click="exportList">
        <Icon name="i-lucide-download" />
        Export
      </Button>
    </PageActions>

    <PageTitle v-model:view="viewScope" title="Clients" :views="VIEWS">
      <template #aside>
        <PageSegmentedTabs v-model="stageFilter" label="Stage" :options="stageTabs" />
      </template>
    </PageTitle>

    <Sheet v-model:open="isAddOpen">
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader class="p-0">
          <SheetTitle>Add Client</SheetTitle>
          <SheetDescription>
            Add a new client to the pipeline.
          </SheetDescription>
        </SheetHeader>

        <form class="flex flex-col gap-4" @submit="onSubmit">
          <FormField v-slot="{ componentField }" name="name">
            <FormItem>
              <FormLabel>Client Name</FormLabel>
              <FormControl>
                <Input type="text" placeholder="Acme Corp" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="grid grid-cols-2 gap-4">
            <FormField v-slot="{ componentField }" name="contactName">
              <FormItem>
                <FormLabel>Contact Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Jane Doe" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="contactEmail">
              <FormItem>
                <FormLabel>Contact Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="jane@acme.com" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <FormField v-slot="{ componentField }" name="contactPhone">
              <FormItem>
                <FormLabel>Contact Phone</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Optional" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="stage">
              <FormItem>
                <FormLabel>Stage</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="option in stages" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <FormField v-slot="{ componentField }" name="assigneeIds">
            <FormItem>
              <FormLabel>Assign to (optional)</FormLabel>
              <FormControl>
                <StaffAssigneePicker v-bind="componentField" :staff="activeStaff" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <DuplicateWarning entity="clients" :matches="duplicateMatches" />

          <SheetFooter class="p-0">
            <Button type="submit" :disabled="!!blockingDuplicate">
              Add Client
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    <DataTable :data="visibleItems" :columns="columns" @select="openClient">
      <template #toolbar="{ table }">
        <DataTableToolbar :table="table" />
      </template>
    </DataTable>

    <ClientDetailSheet v-model:open="isDetailOpen" :client="selectedClient" />
  </div>
</template>
