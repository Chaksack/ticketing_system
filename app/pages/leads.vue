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
import LeadDetailSheet from '~/components/leads/LeadDetailSheet.vue'

definePageMeta({
  middleware: 'bd',
})

const { leads, fetchLeads, fetchLead, addLead } = useLeads()
const { staff, fetchStaff } = useStaff()
const route = useRoute()

onMounted(async () => {
  await Promise.all([fetchLeads(), fetchStaff()])
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

const isDetailOpen = ref(false)
const selectedLeadId = ref<string | null>(null)
const selectedLead = computed(() => leads.value.find(l => l.id === selectedLeadId.value) ?? null)

async function openLead(lead: Lead) {
  selectedLeadId.value = lead.id
  isDetailOpen.value = true
  await fetchLead(lead.id)
}

watch(() => route.query.open, async (openId) => {
  if (typeof openId === 'string')
    await openLead({ id: openId } as Lead)
}, { immediate: true })

const isAddOpen = ref(false)

const leadFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  contactName: z.string().optional(),
  contactEmail: z.string().email({ message: 'Please enter a valid email address.' }).optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  source: z.string().optional(),
  stage: z.enum(['new', 'contacted', 'qualified', 'proposal', 'won', 'lost']),
  assigneeIds: z.array(z.string()).optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: leadFormSchema,
  initialValues: { name: '', contactName: '', contactEmail: '', contactPhone: '', source: '', stage: 'new', assigneeIds: [] },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    const lead = await addLead(values)
    resetForm()
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
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Leads
        </h2>
        <p class="text-muted-foreground">
          Track prospects and convert them into clients once the project starts.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
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

            <FormField v-slot="{ componentField }" name="assigneeIds">
              <FormItem>
                <FormLabel>Assign to (optional)</FormLabel>
                <FormControl>
                  <StaffAssigneePicker v-bind="componentField" :staff="activeStaff" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <SheetFooter class="p-0">
              <Button type="submit">
                Add Lead
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <DataTable :data="leads" :columns="columns" @select="openLead">
      <template #toolbar="{ table }">
        <DataTableToolbar :table="table" />
      </template>
    </DataTable>

    <LeadDetailSheet v-model:open="isDetailOpen" :lead="selectedLead" />
  </div>
</template>
