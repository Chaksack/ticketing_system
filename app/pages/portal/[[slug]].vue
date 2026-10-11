<script setup lang="ts">
import type { Ticket, TicketAttachment, TicketPriority } from '~/types/ticket'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { isValidPhone } from '~/lib/phone'

definePageMeta({
  layout: 'blank',
})

const { addTicket } = useTickets()
const route = useRoute()

// /portal is Canopy's own support portal; /portal/<slug> is that company's portal for its customers.
const workspaceSlug = computed(() => (typeof route.params.slug === 'string' && route.params.slug) ? route.params.slug.toLowerCase() : 'canopy')
const { data: portalData, error: portalError } = await useFetch(() => `/api/portal/${workspaceSlug.value}`)
const isHome = computed(() => !!portalData.value?.workspace.isHome)
const workspaceName = computed(() => isHome.value ? 'Canopy' : (portalData.value?.workspace.name ?? ''))

useSeoMeta({ title: () => workspaceName.value ? `${workspaceName.value} support` : 'Support portal' })

// "How much is this affecting you?" — each choice is a ticket priority; times come from the
// company's own SLA policies (Admin → SLA Policies).
const IMPACTS: { value: TicketPriority, label: string, hint: string }[] = [
  { value: 'urgent', label: 'Critical', hint: 'Operations stopped' },
  { value: 'high', label: 'High', hint: 'Working, but badly affected' },
  { value: 'medium', label: 'Normal', hint: 'Minor issue or a question' },
]

const CATEGORIES = [
  'Something isn\'t working',
  'Question',
  'Billing',
  'Account & access',
  'Feature request',
  'Other',
]

function formatDuration(mins: number) {
  if (mins < 60)
    return `${mins} minutes`
  if (mins < 24 * 60) {
    const hours = Math.round(mins / 60)
    return `${hours} hour${hours === 1 ? '' : 's'}`
  }
  const days = Math.round(mins / (24 * 60))
  return `${days} day${days === 1 ? '' : 's'}`
}

function responseTarget(priority: TicketPriority) {
  return portalData.value?.responseTargets.find(target => target.priority === priority)
}

function responseSentence(priority: TicketPriority) {
  const target = responseTarget(priority)
  const label = IMPACTS.find(impact => impact.value === priority)?.label ?? 'This'
  return target
    ? `${label} requests get a first response within ${formatDuration(target.firstResponseMins)}.`
    : 'Our team will get back to you as soon as possible.'
}

const portalFormSchema = toTypedSchema(z.object({
  subject: z.string().min(3, { message: 'Tell us in a few words what the problem is.' }),
  name: z.string().min(2, { message: 'Please enter your name.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  phone: z.string().refine(isValidPhone, { message: 'Please enter a valid phone number, e.g. +233 24 123 4567.' }),
  category: z.string().min(1, { message: 'Please choose a category.' }),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  description: z.string().min(10, { message: 'Please add a little more detail (at least 10 characters).' }),
  referenceNumber: z.string().optional(),
}))

const { handleSubmit, resetForm, values, setFieldValue } = useForm({
  validationSchema: portalFormSchema,
  initialValues: {
    subject: '',
    name: '',
    email: '',
    phone: '',
    category: '',
    priority: 'medium',
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
const isDragging = ref(false)

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
    const { attachment } = await $fetch<{ attachment: TicketAttachment }>('/api/tickets/attachments', { method: 'POST', body: formData, query: { workspace: workspaceSlug.value } })
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
  isDragging.value = false
  if (event.dataTransfer?.files)
    addFiles(event.dataTransfer.files)
}

function removeFile(id: string) {
  pendingAttachments.value = pendingAttachments.value.filter(a => a.id !== id)
}

const submittedTicket = ref<Ticket | null>(null)
const isSubmitting = ref(false)

const onSubmit = handleSubmit(async (formValues) => {
  isSubmitting.value = true
  try {
    submittedTicket.value = await addTicket({
      subject: formValues.subject,
      description: formValues.description,
      requester: formValues.name,
      requesterEmail: formValues.email,
      requesterPhone: formValues.phone.trim(),
      category: formValues.category,
      priority: formValues.priority,
      referenceNumber: formValues.referenceNumber || undefined,
      attachments: pendingAttachments.value.filter(a => a.status === 'done').map(a => a.attachment!),
    }, { workspace: workspaceSlug.value })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  catch (error: any) {
    toast.error('Could not submit your request', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSubmitting.value = false
  }
})

function startNewRequest() {
  submittedTicket.value = null
  pendingAttachments.value = []
  resetForm()
}

const inputClass = 'min-h-12 w-full rounded-[10px] border border-[#868685] bg-white px-4 text-base font-normal text-brand-obsidian outline-none focus-visible:border-brand-forest focus-visible:ring-[3px] focus-visible:ring-brand-forest/25 aria-invalid:border-destructive'
</script>

<template>
  <div class="flex min-h-svh flex-col bg-white font-sans text-[#454745]">
    <header class="border-b border-brand-fog">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-3.5">
        <div class="flex items-center gap-3">
          <NuxtLink v-if="isHome" to="/" aria-label="Canopy home" class="flex items-center">
            <BrandLogo tone="light" :size="28" />
          </NuxtLink>
          <span v-else class="text-2xl font-black tracking-[-0.04em] text-brand-forest">{{ workspaceName }}</span>
          <span class="border-l border-brand-fog pl-3 text-[15px] font-semibold">Support</span>
        </div>
        <NuxtLink to="/login" class="rounded-full px-3.5 py-2.5 text-[15px] text-brand-forest hover:bg-brand-mist">
          Staff sign in
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto flex w-full max-w-6xl flex-1 flex-wrap items-start gap-7 px-6 pb-16 pt-10">
      <!-- Unknown or inactive workspace -->
      <div v-if="portalError" class="flex flex-col items-start gap-3 py-10">
        <h1 class="m-0 text-[clamp(2.25rem,5vw,3.25rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-obsidian">
          This support portal wasn't found
        </h1>
        <p class="m-0 text-lg">
          Check the link you were given, or contact the company you're trying to reach.
        </p>
      </div>

      <template v-else>
        <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-6">
          <!-- Submitted -->
          <div v-if="submittedTicket" class="flex flex-col gap-4 rounded-[28px] bg-brand-forest p-8 md:p-10" role="status" aria-live="polite">
            <span class="self-start rounded-full bg-brand-lime px-3 py-1.5 text-[13px] font-bold text-brand-forest">Request received</span>
            <h1 class="m-0 text-[clamp(2.25rem,5vw,3rem)] font-black leading-[0.95] tracking-[-0.05em] text-white">
              Case {{ submittedTicket.id }} is open.
            </h1>
            <p class="m-0 text-lg leading-normal text-brand-mist">
              {{ responseSentence(submittedTicket.priority) }}
              We've sent the details to {{ submittedTicket.requesterEmail }} and will update you there. Reply to that email any time to add information.
            </p>
            <div class="flex flex-wrap gap-2.5">
              <button type="button" class="min-h-12 rounded-full border border-brand-mist px-6 text-[15px] text-white hover:bg-white/10" @click="startNewRequest">
                Raise another request
              </button>
            </div>
          </div>

          <!-- Request form -->
          <form v-else class="flex flex-col gap-6" novalidate @submit="onSubmit">
            <h1 class="m-0 text-[clamp(2.5rem,6vw,3.25rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-obsidian">
              How can we help?
            </h1>

            <FormField v-slot="{ field }" name="subject">
              <FormItem>
                <FormLabel class="text-sm font-semibold text-brand-forest">
                  Describe the problem
                </FormLabel>
                <FormControl>
                  <input type="text" placeholder="e.g. Gate 2 barrier keeps raising on its own" class="min-h-14 border-brand-forest text-[17px]" :class="[inputClass]" v-bind="field">
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <fieldset class="m-0 flex flex-col gap-4 border-0 p-0">
              <legend class="mb-3 text-sm font-semibold text-brand-forest">
                Your details
              </legend>
              <div class="grid gap-4 sm:grid-cols-2">
                <FormField v-slot="{ field }" name="name">
                  <FormItem>
                    <FormLabel class="text-sm font-semibold text-brand-forest">
                      Name
                    </FormLabel>
                    <FormControl>
                      <input type="text" autocomplete="name" :class="inputClass" v-bind="field">
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <FormField v-slot="{ field }" name="email">
                  <FormItem>
                    <FormLabel class="text-sm font-semibold text-brand-forest">
                      Email
                    </FormLabel>
                    <FormControl>
                      <input type="email" autocomplete="email" placeholder="you@company.com" :class="inputClass" v-bind="field">
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <FormField v-slot="{ field }" name="phone">
                  <FormItem>
                    <FormLabel class="text-sm font-semibold text-brand-forest">
                      Phone
                    </FormLabel>
                    <FormControl>
                      <input type="tel" inputmode="tel" autocomplete="tel" placeholder="+233 24 123 4567" :class="inputClass" v-bind="field">
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
                <FormField v-slot="{ field }" name="category">
                  <FormItem>
                    <FormLabel class="text-sm font-semibold text-brand-forest">
                      Category
                    </FormLabel>
                    <FormControl>
                      <select :class="inputClass" v-bind="field">
                        <option value="" disabled>
                          What is this about?
                        </option>
                        <option v-for="category in CATEGORIES" :key="category" :value="category">
                          {{ category }}
                        </option>
                      </select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                </FormField>
              </div>
            </fieldset>

            <fieldset class="m-0 border-0 p-0">
              <legend class="mb-2.5 text-sm font-semibold text-brand-forest">
                How much is this affecting you?
              </legend>
              <div role="radiogroup" aria-label="Impact" class="grid gap-2 sm:grid-cols-3">
                <button
                  v-for="impact in IMPACTS"
                  :key="impact.value"
                  type="button"
                  role="radio"
                  :aria-checked="values.priority === impact.value"
                  class="min-h-[72px] rounded-2xl px-4 py-3.5 text-left transition-colors"
                  :class="values.priority === impact.value ? 'border-2 border-brand-forest bg-brand-forest text-white' : 'border border-[#868685] bg-white text-brand-forest hover:bg-brand-mist'"
                  @click="setFieldValue('priority', impact.value)"
                >
                  <span class="block text-[15px] font-bold">{{ impact.label }}</span>
                  <span class="mt-1 block text-[13px] opacity-85">{{ impact.hint }}</span>
                </button>
              </div>
              <p class="m-0 mt-2.5 text-sm text-brand-spruce">
                {{ responseSentence(values.priority ?? 'medium') }}
              </p>
            </fieldset>

            <FormField v-slot="{ field }" name="description">
              <FormItem>
                <FormLabel class="text-sm font-semibold text-brand-forest">
                  Details
                </FormLabel>
                <FormControl>
                  <textarea rows="5" placeholder="When did it start? What have you tried? Who or what is affected?" class="py-3.5" :class="[inputClass]" v-bind="field" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ field }" name="referenceNumber">
              <FormItem>
                <FormLabel class="text-sm font-semibold text-brand-forest">
                  Your reference <span class="font-normal text-[#5d605d]">(optional)</span>
                </FormLabel>
                <FormControl>
                  <input type="text" placeholder="e.g. a site, asset or order number" class="sm:max-w-sm" :class="[inputClass]" v-bind="field">
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div
              class="flex flex-col gap-2.5 rounded-2xl transition-colors"
              :class="isDragging && 'bg-brand-mist p-3'"
              @dragover.prevent="isDragging = true"
              @dragleave="isDragging = false"
              @drop.prevent="onDrop"
            >
              <div v-if="pendingAttachments.length" class="flex flex-wrap gap-2">
                <span
                  v-for="file in pendingAttachments"
                  :key="file.id"
                  class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm"
                  :class="file.status === 'error' ? 'border-destructive text-destructive' : 'border-brand-fog bg-brand-fog text-brand-forest'"
                >
                  <Icon v-if="file.status === 'uploading'" name="i-lucide-loader-2" class="size-3.5 animate-spin" />
                  <Icon v-else-if="file.status === 'error'" name="i-lucide-circle-alert" class="size-3.5" />
                  <Icon v-else name="i-lucide-paperclip" class="size-3.5" />
                  {{ file.name }}
                  <span v-if="file.error" class="text-xs">({{ file.error }})</span>
                  <button type="button" class="ml-0.5 rounded-full p-0.5 hover:bg-black/10" :aria-label="`Remove ${file.name}`" @click="removeFile(file.id)">
                    <Icon name="i-lucide-x" class="size-3.5" />
                  </button>
                </span>
              </div>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <button type="button" class="inline-flex min-h-12 items-center gap-2 rounded-full border border-dashed border-brand-forest bg-white px-5 text-[15px] font-medium text-brand-forest hover:bg-brand-mist" @click="fileInput?.click()">
                  <Icon name="i-lucide-paperclip" class="size-4" />
                  Attach photos or files
                </button>
                <input ref="fileInput" type="file" multiple class="hidden" @change="onFileChange">
                <button type="submit" :disabled="isUploadingAnyAttachment || isSubmitting" class="min-h-12 rounded-full bg-brand-forest px-8 text-[17px] font-semibold text-brand-lime hover:bg-brand-spruce disabled:opacity-60">
                  {{ isUploadingAnyAttachment ? 'Uploading…' : isSubmitting ? 'Sending…' : 'Submit request' }}
                </button>
              </div>
              <span class="text-xs text-[#5d605d]">Images, PDFs, Office documents or ZIP, up to 4MB each. You can also drag files here.</span>
            </div>
          </form>
        </div>

        <aside class="flex min-w-0 flex-[1_1_300px] flex-col gap-4 md:max-w-[380px]">
          <section v-if="portalData?.responseTargets.length" class="flex flex-col gap-2.5 rounded-[28px] bg-brand-fog p-6">
            <h2 class="m-0 text-base font-bold text-brand-forest">
              Response times
            </h2>
            <div v-for="impact in IMPACTS" :key="impact.value" class="flex items-baseline justify-between gap-3 text-sm">
              <span class="font-semibold text-brand-obsidian">{{ impact.label }}</span>
              <span v-if="responseTarget(impact.value)" class="text-right">First response within {{ formatDuration(responseTarget(impact.value)!.firstResponseMins) }}</span>
            </div>
          </section>
          <section class="flex flex-col gap-2.5 rounded-[28px] p-6 ring-1 ring-black/10">
            <h2 class="m-0 text-base font-bold text-brand-obsidian">
              What happens next
            </h2>
            <ol class="m-0 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-normal">
              <li>You get a case number straight away, and a copy by email.</li>
              <li>The right person on {{ isHome ? 'our' : `${workspaceName}'s` }} team picks it up.</li>
              <li>Reply to any update email to add details or photos.</li>
            </ol>
            <p v-if="isHome" class="m-0 text-sm">
              Prefer email? <a href="mailto:support@canopy.com" class="font-semibold text-brand-forest underline">support@canopy.com</a>
            </p>
          </section>
        </aside>
      </template>
    </main>

    <footer class="border-t border-brand-fog px-6 py-4 text-center text-[13px] text-[#5d605d]">
      Customer portal powered by <NuxtLink to="/" class="font-bold text-brand-forest">
        canopy
      </NuxtLink>
    </footer>
  </div>
</template>
