<script setup lang="ts">
import type { Ticket, TicketAttachment } from '~/types/ticket'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'

definePageMeta({
  layout: 'blank',
})

const { addTicket } = useTickets()

const priorityOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
] as const

const categoryOptions = [
  { value: 'BMS', label: 'BMS' },
  { value: 'EBilling', label: 'E-Billing' },
  { value: 'Bug', label: 'Something is broken' },
  { value: 'Maintenance Request', label: 'Maintenance request' },
  { value: 'Question', label: 'General question' },
  { value: 'Other', label: 'Other' },
] as const

const portalFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Please enter your name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  subject: z.string().min(3, { message: 'Summary must be at least 3 characters.' }),
  priority: z.enum(['low', 'medium', 'high', 'urgent'], { required_error: 'Please select a priority.' }),
  category: z.string().min(1, { message: 'Please select a category.' }),
  description: z.string().min(10, { message: 'Please provide more detail (at least 10 characters).' }),
  referenceNumber: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: portalFormSchema,
  initialValues: {
    name: '',
    email: '',
    subject: '',
    priority: 'medium',
    category: '',
    description: '',
    referenceNumber: '',
  },
})

const ALLOWED_ATTACHMENT_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
])
const MAX_ATTACHMENT_SIZE = 4 * 1024 * 1024

interface PendingAttachment {
  id: string
  name: string
  status: 'uploading' | 'done' | 'error'
  attachment?: TicketAttachment
  error?: string
}

const fileInput = ref<HTMLInputElement>()
const pendingAttachments = ref<PendingAttachment[]>([])
const isUploadingAnyAttachment = computed(() => pendingAttachments.value.some(a => a.status === 'uploading'))

async function uploadFile(file: File) {
  const pending: PendingAttachment = { id: `${file.name}-${file.size}-${Date.now()}`, name: file.name, status: 'uploading' }
  pendingAttachments.value.push(pending)

  if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
    pending.status = 'error'
    pending.error = 'File type not supported'
    return
  }
  if (file.size > MAX_ATTACHMENT_SIZE) {
    pending.status = 'error'
    pending.error = 'File must be smaller than 4MB'
    return
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    const { attachment } = await $fetch<{ attachment: TicketAttachment }>('/api/tickets/attachments', { method: 'POST', body: formData })
    pending.status = 'done'
    pending.attachment = attachment
  }
  catch (error: any) {
    pending.status = 'error'
    pending.error = error?.data?.statusMessage ?? 'Upload failed'
  }
}

function addFiles(files: FileList | File[]) {
  for (const file of Array.from(files)) uploadFile(file)
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files)
    addFiles(input.files)
  input.value = ''
}

function onDrop(event: DragEvent) {
  if (event.dataTransfer?.files)
    addFiles(event.dataTransfer.files)
}

function removeFile(id: string) {
  pendingAttachments.value = pendingAttachments.value.filter(a => a.id !== id)
}

const submittedTicket = ref<Ticket | null>(null)

const onSubmit = handleSubmit(async (values) => {
  try {
    submittedTicket.value = await addTicket({
      subject: values.subject,
      description: values.description,
      requester: values.name,
      requesterEmail: values.email,
      category: values.category,
      priority: values.priority,
      referenceNumber: values.referenceNumber || undefined,
      attachments: pendingAttachments.value.filter(a => a.status === 'done').map(a => a.attachment!),
    })
  }
  catch (error: any) {
    toast.error('Could not submit your request', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

function startNewRequest() {
  submittedTicket.value = null
  pendingAttachments.value = []
  resetForm()
}
</script>

<template>
  <div class="min-h-svh flex flex-col bg-muted/30">
    <header class="border-b bg-background">
      <div class="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4">
        <div class="flex items-center gap-2.5">
          <img src="/icons/logo.png" alt="" class="h-8 w-8 rounded">
          <div class="flex flex-col leading-tight">
            <span class="font-semibold">Intelligent Building Solutions</span>
            <span class="text-xs text-muted-foreground">Support Portal</span>
          </div>
        </div>
        <Button variant="outline" size="sm" as-child>
          <NuxtLink to="/login">
            <Icon name="i-lucide-log-in" class="mr-1.5 h-3.5 w-3.5" />
            Staff Sign In
          </NuxtLink>
        </Button>
      </div>
    </header>

    <div class="border-b bg-primary text-primary-foreground">
      <div class="mx-auto flex max-w-5xl flex-col gap-1.5 px-4 py-10">
        <div class="flex items-center gap-2 text-sm text-primary-foreground/80">
          <Icon name="i-lucide-life-buoy" class="h-4 w-4" />
          Customer Support
        </div>
        <h1 class="text-3xl font-bold tracking-tight">
          How can we help?
        </h1>
        <p class="max-w-lg text-primary-foreground/80">
          Raise a support request below and our team will get back to you as soon as possible.
        </p>
      </div>
    </div>

    <main class="flex-1">
      <div class="mx-auto max-w-2xl flex flex-col gap-6 px-4 py-10">
        <Card v-if="!submittedTicket">
          <CardHeader>
            <CardTitle class="text-2xl">
              Contact Support
            </CardTitle>
            <CardDescription>
              Tell us what's going on and our team will get back to you. Fields marked with an asterisk (*) are required.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form class="flex flex-col gap-5" @submit="onSubmit">
              <FormField v-slot="{ componentField }" name="name">
                <FormItem>
                  <FormLabel>Your Name *</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Jane Doe" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="email">
                <FormItem>
                  <FormLabel>Email *</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="jane@example.com" v-bind="componentField" />
                  </FormControl>
                  <FormDescription>
                    We'll send updates about this ticket to this address.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="subject">
                <FormItem>
                  <FormLabel>Summary *</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="A short summary of your request" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <div class="grid gap-5 sm:grid-cols-2">
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
                        <SelectItem v-for="option in priorityOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                </FormField>

                <FormField v-slot="{ componentField }" name="category">
                  <FormItem>
                    <FormLabel>Category *</FormLabel>
                    <Select v-bind="componentField">
                      <FormControl>
                        <SelectTrigger class="w-full">
                          <SelectValue placeholder="What is this about?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem v-for="option in categoryOptions" :key="option.value" :value="option.value">
                          {{ option.label }}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </div>

              <FormField v-slot="{ componentField }" name="description">
                <FormItem>
                  <FormLabel>Description *</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Describe your issue or request in detail" rows="5" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <div class="flex flex-col gap-2">
                <Label>Attachment</Label>
                <div
                  class="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-6 text-center cursor-pointer transition-colors hover:bg-accent/50"
                  @click="fileInput?.click()"
                  @dragover.prevent
                  @drop.prevent="onDrop"
                >
                  <Icon name="i-lucide-upload" class="h-6 w-6 text-muted-foreground" />
                  <p class="text-sm text-muted-foreground">
                    Drag and drop files, or <span class="text-primary underline">browse</span>
                  </p>
                  <input ref="fileInput" type="file" multiple class="hidden" @change="onFileChange">
                </div>
                <div v-if="pendingAttachments.length" class="flex flex-wrap gap-2">
                  <Badge
                    v-for="file in pendingAttachments" :key="file.id" variant="secondary" class="gap-1"
                    :class="file.status === 'error' && 'border-destructive text-destructive'"
                  >
                    <Icon v-if="file.status === 'uploading'" name="i-lucide-loader-2" class="h-3 w-3 animate-spin" />
                    <Icon v-else-if="file.status === 'error'" name="i-lucide-circle-alert" class="h-3 w-3" />
                    <Icon v-else name="i-lucide-paperclip" class="h-3 w-3" />
                    {{ file.name }}
                    <span v-if="file.error" class="text-xs">({{ file.error }})</span>
                    <button type="button" class="ml-1" @click="removeFile(file.id)">
                      <Icon name="i-lucide-x" class="h-3 w-3" />
                    </button>
                  </Badge>
                </div>
              </div>

              <FormField v-slot="{ componentField }" name="referenceNumber">
                <FormItem>
                  <FormLabel>Customer Reference Number</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="Optional" v-bind="componentField" />
                  </FormControl>
                  <FormDescription>
                    Your own reference number for this request, if you have one.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              </FormField>

              <div class="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" as-child>
                  <NuxtLink to="/">
                    Cancel
                  </NuxtLink>
                </Button>
                <Button type="submit" :disabled="isUploadingAnyAttachment">
                  {{ isUploadingAnyAttachment ? 'Uploading…' : 'Send' }}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card v-else>
          <CardContent class="flex flex-col items-center gap-4 py-10 text-center">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Icon name="i-lucide-check" class="h-6 w-6 text-primary" />
            </div>
            <div class="flex flex-col gap-1">
              <h2 class="text-xl font-semibold">
                Request submitted
              </h2>
              <p class="text-muted-foreground">
                Your ticket <span class="font-mono font-medium text-foreground">{{ submittedTicket.id }}</span> has been created.
                Our support team will follow up at <span class="font-medium text-foreground">{{ submittedTicket.requesterEmail }}</span> soon.
              </p>
            </div>
            <Button @click="startNewRequest">
              Submit another request
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>

    <footer class="border-t bg-background">
      <div class="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-6 text-center text-xs text-muted-foreground sm:flex-row sm:justify-between sm:text-left">
        <span>© {{ new Date().getFullYear() }} Intelligent Building Solutions. All rights reserved.</span>
        <a href="mailto:support@ibsgh.com" class="hover:text-foreground hover:underline">support@ibsgh.com</a>
      </div>
    </footer>
  </div>
</template>
