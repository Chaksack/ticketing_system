<script setup lang="ts">
import type { Ticket } from '~/types/ticket'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { columns } from '@/components/tickets/components/columns'
import DataTable from '@/components/tickets/components/DataTable.vue'
import { priorities } from '@/components/tickets/data/data'
import TicketDetailSheet from '@/components/tickets/TicketDetailSheet.vue'

definePageMeta({
  middleware: 'agent',
})

const { tickets, fetchTickets, fetchTicket, addTicket } = useTickets()
const { staff, fetchStaff } = useStaff()

onMounted(() => {
  fetchTickets()
  fetchStaff()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

const isDetailOpen = ref(false)
const selectedTicketId = ref<string | null>(null)
const selectedTicket = computed(() => tickets.value.find(t => t.id === selectedTicketId.value) ?? null)

async function openTicket(ticket: Ticket) {
  selectedTicketId.value = ticket.id
  isDetailOpen.value = true
  await fetchTicket(ticket.id)
}

const isReportOpen = ref(false)

const reportFormSchema = toTypedSchema(z.object({
  subject: z.string().min(3, { message: 'Subject must be at least 3 characters.' }),
  description: z.string().min(10, { message: 'Please provide more detail (at least 10 characters).' }),
  requester: z.string().min(2, { message: 'Requester name is required.' }),
  requesterEmail: z.string().email({ message: 'Please enter a valid email address.' }),
  category: z.string().min(2, { message: 'Category is required.' }),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], { required_error: 'Please select a priority.' }),
  assigneeId: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: reportFormSchema,
  initialValues: { subject: '', description: '', requester: '', requesterEmail: '', category: '', priority: 'medium', assigneeId: undefined },
})

const onReportSubmit = handleSubmit(async (values) => {
  try {
    const ticket = await addTicket({ ...values, assigneeId: values.assigneeId || undefined })
    resetForm()
    isReportOpen.value = false
    toast('Ticket reported', {
      description: `${ticket.id} was created and on-call staff have been paged.`,
    })
  }
  catch (error: any) {
    toast('Could not report ticket', {
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
          Tickets
        </h2>
        <p class="text-muted-foreground">
          Here&apos;s a list of tickets.
        </p>
      </div>

      <Dialog v-model:open="isReportOpen">
        <DialogTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            Report Ticket
          </Button>
        </DialogTrigger>
        <DialogContent>
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
    </div>
    <DataTable :data="tickets" :columns="columns" @select="openTicket" />

    <TicketDetailSheet v-model:open="isDetailOpen" :ticket="selectedTicket" />
  </div>
</template>

<style scoped>

</style>
