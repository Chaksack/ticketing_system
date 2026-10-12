<script setup lang="ts">
import type { Lead } from '~/types/lead'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import DataTable from '~/components/data-table/DataTable.vue'
import { columns } from '~/components/leads/components/columns'
import DataTableToolbar from '~/components/leads/components/DataTableToolbar.vue'
import { leadStages } from '~/components/leads/data'
import { optionalAmount } from '~/lib/formNumbers'

definePageMeta({
  middleware: 'bd',
})

const { leads, fetchLeads, addLead } = useLeads()
const { staff, fetchStaff } = useStaff()
const route = useRoute()

const viewScope = ref<'all' | 'team'>('all')

onMounted(async () => {
  await Promise.all([fetchLeads(), fetchStaff()])
})

watch(viewScope, scope => fetchLeads(scope === 'team' ? { scope: 'team' } : undefined))

const VIEWS = [
  { value: 'all', label: 'All leads' },
  { value: 'team', label: 'My team\'s leads' },
] as const

type StageFilter = 'all' | 'open' | 'won' | 'lost'
const stageFilter = ref<StageFilter>('all')
const OPEN_STAGES = new Set(['new', 'contacted', 'qualified', 'proposal'])
function matchesStage(lead: Lead, filter: StageFilter) {
  return filter === 'all' || (filter === 'open' ? OPEN_STAGES.has(lead.stage) : lead.stage === filter)
}
const stageTabs = computed(() => ([
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
] as const).map(tab => ({ ...tab, count: leads.value.filter(lead => matchesStage(lead, tab.value)).length })))
const visibleLeads = computed(() => leads.value.filter(lead => matchesStage(lead, stageFilter.value)))

function exportLeads() {
  downloadCsv('leads.csv', ['ID', 'Name', 'Contact', 'Email', 'Phone', 'Source', 'Stage', 'Estimated value', 'Assignees', 'Created'], visibleLeads.value.map(lead => [
    lead.id,
    lead.name,
    lead.contactName,
    lead.contactEmail,
    lead.contactPhone,
    lead.source,
    leadStages.find(stage => stage.value === lead.stage)?.label ?? lead.stage,
    lead.estimatedValue,
    lead.assignees.map(a => a.name).join('; '),
    lead.createdAt?.slice(0, 10),
  ]))
}

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

function openLead(lead: Lead) {
  navigateTo(`/leads/${lead.id}`)
}

// Older links (notifications, search, emails) use /leads?open=<id>.
watch(() => route.query.open, (openId) => {
  if (typeof openId === 'string')
    navigateTo(`/leads/${openId}`, { replace: true })
}, { immediate: true })

const isAddOpen = ref(false)

const leadFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  contactName: z.string().optional(),
  contactEmail: z.string().email({ message: 'Please enter a valid email address.' }).optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']),
  estimatedValue: optionalAmount(),
  assigneeIds: z.array(z.string()).optional(),
}))

const { handleSubmit, resetForm, values } = useForm({
  validationSchema: leadFormSchema,
  initialValues: { name: '', contactName: '', contactEmail: '', contactPhone: '', source: '', stage: 'new', estimatedValue: undefined, assigneeIds: [] },
})

const { matches: duplicateMatches, blockingMatch: blockingDuplicate, check: checkDuplicate, reset: resetDuplicateCheck } = useDuplicateCheck('leads')

watch([() => values.name, () => values.contactEmail, () => values.contactPhone], () => {
  checkDuplicate({ name: values.name, email: values.contactEmail, phone: values.contactPhone })
})

const onSubmit = handleSubmit(async (values) => {
  try {
    const lead = await addLead({
      ...values,
      estimatedValue: values.estimatedValue,
    })
    resetForm()
    resetDuplicateCheck()
    isAddOpen.value = false
    toast('Lead added', {
      description: `${lead.name} was added to the pipeline.`,
    })
  }
  catch (error: any) {
    toast.error('Could not add lead', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <PageActions label="Lead actions">
      <Button variant="lime" @click="isAddOpen = true">
        <Icon name="i-lucide-plus" />
        New lead
      </Button>
      <Button variant="ghost" :disabled="!visibleLeads.length" @click="exportLeads">
        <Icon name="i-lucide-download" />
        Export
      </Button>
    </PageActions>

    <PageTitle v-model:view="viewScope" title="Leads" :views="VIEWS">
      <template #aside>
        <PageSegmentedTabs v-model="stageFilter" label="Stage" :options="stageTabs" />
      </template>
    </PageTitle>

    <Sheet v-model:open="isAddOpen">
      <SheetContent side="right" class="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader class="p-0">
          <SheetTitle>Add Lead</SheetTitle>
          <SheetDescription>
            Add a new prospect to the pipeline.
          </SheetDescription>
        </SheetHeader>

        <form class="flex flex-col gap-4" @submit="onSubmit">
          <FormField v-slot="{ componentField }" name="name">
            <FormItem>
              <FormLabel>Lead Name</FormLabel>
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

            <FormField v-slot="{ componentField }" name="source">
              <FormItem>
                <FormLabel>Source</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Referral" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

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
                  <SelectItem v-for="option in leadStages" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="estimatedValue">
            <FormItem>
              <FormLabel>Estimated Value</FormLabel>
              <FormControl>
                <Input type="number" placeholder="Optional" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="assigneeIds">
            <FormItem>
              <FormLabel>Assign to (optional)</FormLabel>
              <FormControl>
                <StaffAssigneePicker v-bind="componentField" :staff="activeStaff" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <DuplicateWarning entity="leads" :matches="duplicateMatches" />

          <SheetFooter class="p-0">
            <Button type="submit" :disabled="!!blockingDuplicate">
              Add Lead
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    <DataTable :data="visibleLeads" :columns="columns" @select="openLead">
      <template #toolbar="{ table }">
        <DataTableToolbar :table="table" />
      </template>
    </DataTable>
  </div>
</template>
