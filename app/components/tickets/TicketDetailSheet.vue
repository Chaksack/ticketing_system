<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { Ticket, TicketStatus } from '~/types/ticket'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { priorities, statuses } from './data/data'

const props = defineProps<{
  ticket: Ticket | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { addReply, updateStatus } = useTickets()

const status = computed(() => statuses.find(s => s.value === props.ticket?.status))
const priority = computed(() => priorities.find(p => p.value === props.ticket?.priority))

async function onStatusChange(value: AcceptableValue) {
  if (!props.ticket || value === null)
    return

  await updateStatus(props.ticket.id, value as TicketStatus)

  toast(value === 'closed' ? 'Ticket closed' : 'Status updated', {
    description: `${props.ticket.id} is now ${statuses.find(s => s.value === value)?.label.toLowerCase()}.`,
  })
}

const replySchema = toTypedSchema(z.object({
  message: z.string().min(1, { message: 'Reply cannot be empty.' }),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: replySchema,
  initialValues: { message: '' },
})

const onSubmit = handleSubmit(async (values) => {
  if (!props.ticket)
    return

  await addReply(props.ticket.id, values.message)
  resetForm()
  toast('Reply sent', {
    description: `Your reply was added to ${props.ticket.id}.`,
  })
})

function formatDate(value: string) {
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
      <template v-if="ticket">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ ticket.id }}
          </SheetDescription>
          <SheetTitle>{{ ticket.subject }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="outline">
              {{ ticket.category }}
            </Badge>
            <Select :model-value="ticket.status" @update:model-value="onStatusChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <component :is="status?.icon" v-if="status?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in statuses" :key="s.value" :value="s.value">
                  <span class="flex items-center gap-2">
                    <component :is="s.icon" v-if="s.icon" class="h-3.5 w-3.5" />
                    {{ s.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <Badge v-if="priority" variant="secondary" class="gap-1">
              <component :is="priority.icon" v-if="priority.icon" class="h-3.5 w-3.5" />
              {{ priority.label }}
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground pt-1">
            Requested by <span class="font-medium text-foreground">{{ ticket.requester }}</span> ({{ ticket.requesterEmail }}) on {{ formatDate(ticket.createdAt) }}
          </p>
          <p v-if="ticket.referenceNumber" class="text-xs text-muted-foreground">
            Reference: {{ ticket.referenceNumber }}
          </p>
        </SheetHeader>

        <ScrollArea class="h-[calc(100vh-2px)]">
          <div class="flex flex-col gap-6 px-6 pt-4">
            <p class="text-sm leading-relaxed">
              {{ ticket.description }}
            </p>

            <div v-if="ticket.attachments?.length" class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Attachments
              </h4>
              <div class="flex flex-wrap gap-2">
                <Badge v-for="file in ticket.attachments" :key="file" variant="outline" class="gap-1">
                  <Icon name="i-lucide-paperclip" class="h-3 w-3" />
                  {{ file }}
                </Badge>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-4">
              <h4 class="text-sm font-medium">
                Conversation
              </h4>

              <p v-if="!ticket.replies.length" class="text-sm text-muted-foreground">
                No replies yet.
              </p>

              <div v-for="reply in ticket.replies" :key="reply.id" class="flex flex-col gap-1 rounded-md border p-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{{ reply.author }}</span>
                  <span class="text-xs text-muted-foreground">{{ formatDate(reply.createdAt) }}</span>
                </div>
                <p class="text-sm text-muted-foreground">
                  {{ reply.message }}
                </p>
              </div>
            </div>

            <Separator />

            <form class="flex flex-col gap-3 pb-6" @submit="onSubmit">
              <FormField v-slot="{ componentField }" name="message">
                <FormItem>
                  <FormLabel>Reply</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Type your reply..." rows="4" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <div class="flex justify-end">
                <Button type="submit">
                  Send reply
                </Button>
              </div>
            </form>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
