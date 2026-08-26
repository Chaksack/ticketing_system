<script setup lang="ts">
import type { Client } from '~/types/client'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import ClientDetailSheet from '~/components/clients/ClientDetailSheet.vue'
import { stages } from '~/components/clients/data'

definePageMeta({
  middleware: 'bd',
})

const { clients, fetchClients, fetchClient, addClient } = useClients()
const { staff, fetchStaff } = useStaff()
const route = useRoute()

onMounted(async () => {
  await Promise.all([fetchClients(), fetchStaff()])
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

function stageLabel(value: string) {
  return stages.find(s => s.value === value)?.label ?? value
}

function stageBadgeClass(value: string) {
  return stages.find(s => s.value === value)?.badgeClass
}

const searchQuery = ref('')
const stageFilter = ref('all')
const assigneeFilter = ref('all')

const filteredClients = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return clients.value.filter((client) => {
    if (stageFilter.value !== 'all' && client.stage !== stageFilter.value)
      return false
    if (assigneeFilter.value === 'unassigned' && client.assignees.length)
      return false
    else if (assigneeFilter.value !== 'all' && assigneeFilter.value !== 'unassigned' && !client.assignees.some(a => a.id === assigneeFilter.value))
      return false
    if (query) {
      const haystack = `${client.name} ${client.contactName ?? ''} ${client.contactEmail ?? ''}`.toLowerCase()
      if (!haystack.includes(query))
        return false
    }
    return true
  })
})

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

const { handleSubmit, resetForm } = useForm({
  validationSchema: clientFormSchema,
  initialValues: { name: '', contactName: '', contactEmail: '', contactPhone: '', stage: 'lead', assigneeIds: [] },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    const client = await addClient(values)
    resetForm()
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
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Clients
        </h2>
        <p class="text-muted-foreground">
          Manage clients and track their progress through the pipeline.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </SheetTrigger>
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

            <SheetFooter class="p-0">
              <Button type="submit">
                Add Client
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search clients..." class="pl-8" />
      </div>
      <Select v-model="stageFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All stages
          </SelectItem>
          <SelectItem v-for="option in stages" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="assigneeFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All assignees
          </SelectItem>
          <SelectItem value="unassigned">
            Unassigned
          </SelectItem>
          <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
            {{ member.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Assigned To</TableHead>
            <TableHead>Active AMC</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredClients.length">
            <TableRow
              v-for="client in filteredClients"
              :key="client.id"
              class="cursor-pointer"
              @click="openClient(client)"
            >
              <TableCell class="font-medium">
                {{ client.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ client.contactName || client.contactEmail || '—' }}
              </TableCell>
              <TableCell>
                <Badge variant="outline" :class="stageBadgeClass(client.stage)">
                  {{ stageLabel(client.stage) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ client.assignees.length ? client.assignees.map(a => a.name).join(', ') : 'Unassigned' }}
              </TableCell>
              <TableCell>{{ client.activeContractCount ?? 0 }}</TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No clients match your filters.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ClientDetailSheet v-model:open="isDetailOpen" :client="selectedClient" />
  </div>
</template>
