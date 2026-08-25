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

  const openId = route.query.open
  if (typeof openId === 'string') {
    await openClient({ id: openId } as Client)
  }
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

function stageLabel(value: string) {
  return stages.find(s => s.value === value)?.label ?? value
}

const isDetailOpen = ref(false)
const selectedClientId = ref<string | null>(null)
const selectedClient = computed(() => clients.value.find(c => c.id === selectedClientId.value) ?? null)

async function openClient(client: Client) {
  selectedClientId.value = client.id
  isDetailOpen.value = true
  await fetchClient(client.id)
}

const isAddOpen = ref(false)

const clientFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  contactName: z.string().optional(),
  contactEmail: z.string().email({ message: 'Please enter a valid email address.' }).optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  stage: z.enum(['lead', 'contacted', 'proposal', 'negotiation', 'active', 'lost']),
  assignedTo: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: clientFormSchema,
  initialValues: { name: '', contactName: '', contactEmail: '', contactPhone: '', stage: 'lead', assignedTo: undefined },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    const client = await addClient({ ...values, assignedTo: values.assignedTo || undefined })
    resetForm()
    isAddOpen.value = false
    toast('Client added', {
      description: `${client.name} was added to the pipeline.`,
    })
  }
  catch (error: any) {
    toast('Could not add client', {
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

      <Dialog v-model:open="isAddOpen">
        <DialogTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Client</DialogTitle>
            <DialogDescription>
              Add a new client to the pipeline.
            </DialogDescription>
          </DialogHeader>

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

            <FormField v-slot="{ componentField }" name="assignedTo">
              <FormItem>
                <FormLabel>Assign to (optional)</FormLabel>
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
                Add Client
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
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
          <template v-if="clients.length">
            <TableRow
              v-for="client in clients"
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
                <Badge variant="outline">
                  {{ stageLabel(client.stage) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ client.assignedToName || 'Unassigned' }}
              </TableCell>
              <TableCell>{{ client.activeContractCount ?? 0 }}</TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No clients yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ClientDetailSheet v-model:open="isDetailOpen" :client="selectedClient" />
  </div>
</template>
