<script setup lang="ts">
import type { Tender } from '~/types/tender'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import DataTable from '~/components/data-table/DataTable.vue'
import { columns } from '~/components/tenders/components/columns'
import DataTableToolbar from '~/components/tenders/components/DataTableToolbar.vue'
import { tenderStages } from '~/components/tenders/data'
import { optionalAmount } from '~/lib/formNumbers'

definePageMeta({
  middleware: 'bd',
})

const { tenders, fetchTenders, addTender } = useTenders()
const { staff, fetchStaff } = useStaff()
const route = useRoute()

const viewScope = ref<'all' | 'team'>('all')

onMounted(async () => {
  await Promise.all([fetchTenders(), fetchStaff()])
})

watch(viewScope, scope => fetchTenders(scope === 'team' ? { scope: 'team' } : undefined))

const VIEWS = [
  { value: 'all', label: 'All tenders' },
  { value: 'team', label: 'My team\'s tenders' },
] as const

type StageFilter = 'all' | 'open' | 'won' | 'lost'
const stageFilter = ref<StageFilter>('all')
function matchesStage(tender: Tender, filter: StageFilter) {
  return filter === 'all' || (filter === 'open' ? tender.stage !== 'won' && tender.stage !== 'lost' : tender.stage === filter)
}
const stageTabs = computed(() => ([
  { value: 'all', label: 'All' },
  { value: 'open', label: 'In progress' },
  { value: 'won', label: 'Won' },
  { value: 'lost', label: 'Lost' },
] as const).map(tab => ({ ...tab, count: tenders.value.filter(tender => matchesStage(tender, tab.value)).length })))
const visibleItems = computed(() => tenders.value.filter(tender => matchesStage(tender, stageFilter.value)))

function exportList() {
  downloadCsv('tenders.csv', ['ID', 'Title', 'Issuing authority', 'Reference', 'Stage', 'Estimated value', 'Submission deadline', 'Assignees', 'Created'], visibleItems.value.map(tender => [
    tender.id,
    tender.title,
    tender.issuingAuthority,
    tender.referenceNumber,
    tenderStages.find(stage => stage.value === tender.stage)?.label ?? tender.stage,
    tender.estimatedValue,
    tender.submissionDeadline?.slice(0, 10),
    tender.assignees.map(a => a.name).join('; '),
    tender.createdAt?.slice(0, 10),
  ]))
}

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

function openTender(tender: Tender) {
  navigateTo(`/tenders/${tender.id}`)
}

// Older links (notifications, search, emails) use /tenders?open=<id>.
watch(() => route.query.open, (openId) => {
  if (typeof openId === 'string')
    navigateTo(`/tenders/${openId}`, { replace: true })
}, { immediate: true })

const isAddOpen = ref(false)

const tenderFormSchema = toTypedSchema(z.object({
  title: z.string().min(2, { message: 'Title must be at least 2 characters.' }),
  issuingAuthority: z.string().optional(),
  referenceNumber: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email({ message: 'Please enter a valid email address.' }).optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(['identified', 'registered', 'preparing', 'submitted', 'evaluation', 'won', 'lost']),
  estimatedValue: optionalAmount(),
  submissionDeadline: z.string().optional(),
  assigneeIds: z.array(z.string()).optional(),
}))

const { handleSubmit, resetForm, values } = useForm({
  validationSchema: tenderFormSchema,
  initialValues: { title: '', issuingAuthority: '', referenceNumber: '', contactName: '', contactEmail: '', contactPhone: '', source: '', stage: 'identified', estimatedValue: undefined, submissionDeadline: '', assigneeIds: [] },
})

const { matches: duplicateMatches, check: checkDuplicate, reset: resetDuplicateCheck } = useDuplicateCheck('tenders')

watch([() => values.title, () => values.contactEmail, () => values.contactPhone], () => {
  checkDuplicate({ name: values.title, email: values.contactEmail, phone: values.contactPhone })
})

const onSubmit = handleSubmit(async (values) => {
  try {
    const tender = await addTender({
      ...values,
      estimatedValue: values.estimatedValue,
      submissionDeadline: values.submissionDeadline ? new Date(values.submissionDeadline).toISOString() : undefined,
    })
    resetForm()
    resetDuplicateCheck()
    isAddOpen.value = false
    toast('Tender added', {
      description: `${tender.title} was added to the pipeline.`,
    })
  }
  catch (error: any) {
    toast.error('Could not add tender', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <PageActions label="Tenders actions">
      <Button variant="lime" @click="isAddOpen = true">
        <Icon name="i-lucide-plus" />
        New tender
      </Button>
      <Button variant="ghost" :disabled="!visibleItems.length" @click="exportList">
        <Icon name="i-lucide-download" />
        Export
      </Button>
    </PageActions>

    <PageTitle v-model:view="viewScope" title="Tenders" :views="VIEWS">
      <template #aside>
        <PageSegmentedTabs v-model="stageFilter" label="Stage" :options="stageTabs" />
      </template>
    </PageTitle>

    <Sheet v-model:open="isAddOpen">
      <SheetContent side="right" class="w-full sm:max-w-xl overflow-y-auto p-6">
        <SheetHeader class="p-0">
          <SheetTitle>Add Tender</SheetTitle>
          <SheetDescription>
            Register a new tender opportunity.
          </SheetDescription>
        </SheetHeader>

        <form class="flex flex-col gap-4" @submit="onSubmit">
          <FormField v-slot="{ componentField }" name="title">
            <FormItem>
              <FormLabel>Tender Title</FormLabel>
              <FormControl>
                <Input type="text" placeholder="e.g. BMS Installation - City Hospital" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="grid grid-cols-2 gap-4">
            <FormField v-slot="{ componentField }" name="issuingAuthority">
              <FormItem>
                <FormLabel>Issuing Authority</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Ministry of Works" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="referenceNumber">
              <FormItem>
                <FormLabel>Reference Number</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Optional" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

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
                  <Input type="email" placeholder="jane@authority.gov" v-bind="componentField" />
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
                  <Input type="text" placeholder="e.g. Tender portal" v-bind="componentField" />
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
                  <SelectItem v-for="option in tenderStages" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          </FormField>

          <div class="grid grid-cols-2 gap-4">
            <FormField v-slot="{ componentField }" name="estimatedValue">
              <FormItem>
                <FormLabel>Estimated Value</FormLabel>
                <FormControl>
                  <Input type="number" placeholder="Optional" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="submissionDeadline">
              <FormItem>
                <FormLabel>Submission Deadline</FormLabel>
                <FormControl>
                  <Input type="date" v-bind="componentField" />
                </FormControl>
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

          <Alert v-if="duplicateMatches.length">
            <Icon name="i-lucide-triangle-alert" class="h-4 w-4" />
            <AlertTitle>Possible duplicate</AlertTitle>
            <AlertDescription>
              <span v-for="(match, index) in duplicateMatches" :key="match.id">
                {{ match.label }} ({{ match.stage }})<span v-if="index < duplicateMatches.length - 1">, </span>
              </span>
              already exists. You can still add this tender.
            </AlertDescription>
          </Alert>

          <SheetFooter class="p-0">
            <Button type="submit">
              Add Tender
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>

    <DataTable :data="visibleItems" :columns="columns" @select="openTender">
      <template #toolbar="{ table }">
        <DataTableToolbar :table="table" />
      </template>
    </DataTable>
  </div>
</template>
