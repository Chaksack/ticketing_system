<script setup lang="ts">
import type { WorkOrderDetail, WorkOrderStatus, WorkOrderTask } from '~/types/field'
import { toast } from 'vue-sonner'
import { WORK_ORDER_STATUSES } from '~/types/field'

// The technician's view of one job ("Mobile — Technician work order" in the Canopy design) —
// built phone-first, and the same page dispatchers open from the board.
definePageMeta({ middleware: 'agent' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { isAdmin, currentUser } = useAuth()
const isDispatcher = computed(() => isAdmin.value || (currentUser.value?.roles ?? []).some(r => ['agent', 'engineering_coordinator', 'engineering_lead'].includes(r)))

const order = ref<WorkOrderDetail | null>(null)
const notFound = ref(false)
const notes = ref('')

async function load() {
  try {
    order.value = (await fetchUntyped<{ workOrder: WorkOrderDetail }>(`/api/field/work-orders/${id.value}`)).workOrder
    notes.value = order.value.resolutionNotes ?? ''
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
  }
}
onMounted(load)

const busy = ref(false)
async function patch(body: Record<string, unknown>, message?: string) {
  if (!order.value)
    return
  busy.value = true
  try {
    const { workOrder } = await fetchUntyped<{ workOrder: WorkOrderDetail }>(`/api/field/work-orders/${id.value}`, { method: 'PATCH', body })
    order.value = { ...order.value, ...workOrder }
    if (message)
      toast(message)
  }
  catch (error: any) {
    toast.error('Not saved', { description: error?.data?.statusMessage ?? 'Check your connection and try again.' })
  }
  finally {
    busy.value = false
  }
}

function toggleTask(index: number) {
  if (!order.value)
    return
  const tasks: WorkOrderTask[] = order.value.tasks.map((task, i) => i === index ? { ...task, done: !task.done } : task)
  order.value.tasks = tasks
  patch({ tasks })
}

const newTask = ref('')
function addTask() {
  if (!order.value || !newTask.value.trim())
    return
  const tasks = [...order.value.tasks, { label: newTask.value.trim(), done: false }]
  newTask.value = ''
  patch({ tasks })
}

const doneCount = computed(() => order.value?.tasks.filter(t => t.done).length ?? 0)

async function upload(file: Blob, name: string) {
  const form = new FormData()
  form.append('file', file, name)
  form.append('folder', 'field')
  return (await fetchUntyped<{ url: string, name: string }>('/api/uploads/image', { method: 'POST', body: form })).url
}

const photoInput = ref<HTMLInputElement>()
const uploading = ref(false)
async function addPhotos(event: Event) {
  const files = [...((event.target as HTMLInputElement).files ?? [])]
  uploading.value = true
  try {
    for (const file of files) {
      const url = await upload(file, file.name)
      await patch({ addPhoto: { url, name: file.name } })
    }
    if (files.length)
      toast(`${files.length} photo${files.length === 1 ? '' : 's'} added`)
  }
  catch (error: any) {
    toast.error('Photo upload failed', { description: error?.data?.statusMessage })
  }
  finally {
    uploading.value = false
    if (photoInput.value)
      photoInput.value.value = ''
  }
}

const isSignOpen = ref(false)
const signedBy = ref('')
async function saveSignature(png: Blob) {
  try {
    const url = await upload(png, `signature-${id.value}.png`)
    await patch({ signatureUrl: url, signedBy: signedBy.value }, 'Signature saved')
    isSignOpen.value = false
  }
  catch (error: any) {
    toast.error('Signature not saved', { description: error?.data?.statusMessage })
  }
}

async function complete() {
  if (!notes.value.trim()) {
    toast.error('Add a short note on what was done first')
    return
  }
  await patch({ action: 'complete', resolutionNotes: notes.value }, 'Work order completed')
}

const directionsUrl = computed(() => order.value?.location ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(order.value.location)}` : null)
const statusLabel = (status: WorkOrderStatus) => WORK_ORDER_STATUSES.find(s => s.value === status)?.label ?? status
const time = (iso?: string) => iso ? new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : '—'
const dateTime = (iso?: string) => iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—'
const durationLabel = (minutes: number) => minutes % 60 ? `${Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)} h ` : ''}${minutes % 60} min` : `${minutes / 60} h`
const slaBreached = computed(() => !!order.value?.slaDueAt && new Date(order.value.slaDueAt) < new Date() && !['completed', 'cancelled'].includes(order.value.status))
const isOpen = computed(() => !!order.value && !['completed', 'cancelled'].includes(order.value.status))
</script>

<template>
  <div class="mx-auto flex w-full max-w-xl flex-col gap-3">
    <p v-if="notFound" class="text-muted-foreground">
      This work order doesn't exist, or it isn't assigned to you.
    </p>

    <template v-else-if="order">
      <div class="dark flex flex-col gap-3.5 rounded-[28px] bg-brand-forest px-4 pb-5 pt-4 text-white">
        <div class="flex items-center justify-between">
          <NuxtLink :to="isDispatcher ? '/field' : '/field/work-orders'" aria-label="Back" class="flex size-11 items-center justify-center rounded-full bg-brand-spruce">
            <Icon name="i-lucide-chevron-left" class="size-5" />
          </NuxtLink>
          <span class="rounded-full bg-brand-spruce px-3 py-1.5 text-xs font-semibold text-brand-mist">{{ statusLabel(order.status) }}</span>
        </div>
        <div>
          <div class="text-[13px] font-semibold text-brand-lime">
            {{ order.id }} · {{ order.priority[0]!.toUpperCase() + order.priority.slice(1) }} priority
          </div>
          <h1 class="mt-1.5 text-3xl font-black leading-none tracking-[-0.045em] text-white">
            {{ order.title }}
          </h1>
          <div class="mt-1.5 text-sm text-brand-mist">
            {{ [order.clientName, order.location].filter(Boolean).join(' · ') || 'No site address' }}
          </div>
        </div>
        <div v-if="isOpen" class="grid grid-cols-2 gap-2">
          <button v-if="order.status === 'scheduled'" type="button" class="min-h-12 rounded-full bg-brand-lime text-[15px] font-bold text-brand-forest disabled:opacity-60" :disabled="busy || !order.technicianId" @click="patch({ action: 'start_travel' }, 'Travel started')">
            Start travel
          </button>
          <button v-else-if="order.status === 'travelling' || order.status === 'unscheduled'" type="button" class="min-h-12 rounded-full bg-brand-lime text-[15px] font-bold text-brand-forest disabled:opacity-60" :disabled="busy || !order.technicianId" @click="patch({ action: 'start_work' }, 'On site')">
            Arrived — start work
          </button>
          <a v-if="order.status === 'in_progress'" href="#finish" class="flex min-h-12 items-center justify-center rounded-full bg-brand-lime text-[15px] font-bold text-brand-forest">Finish job</a>
          <a v-if="directionsUrl" :href="directionsUrl" target="_blank" rel="noopener" class="flex min-h-12 items-center justify-center rounded-full border border-brand-mist text-[15px] font-medium text-white">Directions</a>
        </div>
        <p v-if="!order.technicianId && isOpen" class="m-0 text-sm text-brand-mist">
          Not scheduled yet{{ isDispatcher ? ' — place it on the schedule board.' : '.' }}
        </p>
      </div>

      <div class="grid grid-cols-3 gap-2">
        <div class="rounded-2xl bg-card p-3 ring-1 ring-black/10 dark:ring-white/10">
          <div class="text-xs text-muted-foreground">
            Arrive by
          </div>
          <div class="font-bold text-foreground">
            {{ time(order.scheduledStart) }}
          </div>
        </div>
        <div class="rounded-2xl bg-card p-3 ring-1 ring-black/10 dark:ring-white/10">
          <div class="text-xs text-muted-foreground">
            Duration
          </div>
          <div class="font-bold text-foreground">
            {{ durationLabel(order.durationMinutes) }}
          </div>
        </div>
        <div class="rounded-2xl p-3" :class="slaBreached ? 'bg-destructive/10 text-destructive' : 'bg-card ring-1 ring-black/10 dark:ring-white/10'">
          <div class="text-xs" :class="slaBreached ? '' : 'text-muted-foreground'">
            SLA
          </div>
          <div class="font-bold" :class="slaBreached ? '' : 'text-foreground'">
            {{ order.slaDueAt ? dateTime(order.slaDueAt) : '—' }}
          </div>
        </div>
      </div>

      <section v-if="order.description" class="rounded-[20px] bg-card p-4 text-sm leading-normal ring-1 ring-black/10 dark:ring-white/10">
        <h2 class="m-0 mb-1 text-base font-bold text-foreground">
          Notes
        </h2>
        <p class="m-0 whitespace-pre-wrap">
          {{ order.description }}
        </p>
        <NuxtLink v-if="order.ticketId" :to="`/tickets?open=${order.ticketId}`" class="mt-2 inline-block font-semibold text-primary underline-offset-2 hover:underline dark:text-brand-lime">
          From ticket {{ order.ticketId }}
        </NuxtLink>
      </section>

      <section class="flex flex-col gap-1 rounded-[20px] bg-card p-4 ring-1 ring-black/10 dark:ring-white/10">
        <div class="flex items-center justify-between">
          <h2 class="m-0 text-base font-bold text-foreground">
            Service tasks
          </h2>
          <span class="text-[13px] font-semibold text-primary dark:text-brand-lime">{{ doneCount }} of {{ order.tasks.length }}</span>
        </div>
        <label v-for="(task, index) in order.tasks" :key="index" class="flex min-h-11 items-center gap-3 text-[15px] text-foreground">
          <input type="checkbox" :checked="task.done" :disabled="!isOpen" class="size-[22px] accent-brand-forest" @change="toggleTask(index)">
          <span :class="task.done ? 'text-muted-foreground line-through' : ''">{{ task.label }}</span>
        </label>
        <form v-if="isOpen" class="mt-1 flex gap-2" @submit.prevent="addTask">
          <Input v-model="newTask" placeholder="Add a task" aria-label="New task" />
          <Button type="submit" variant="outline" :disabled="!newTask.trim()">
            Add
          </Button>
        </form>
      </section>

      <section class="flex flex-col gap-1.5 rounded-[20px] bg-brand-mist p-4 text-brand-forest dark:bg-brand-spruce dark:text-brand-mist">
        <h2 class="m-0 text-base font-bold">
          Asset history
        </h2>
        <p v-if="!order.assetId" class="m-0 text-sm">
          No asset is linked to this job.
        </p>
        <template v-else>
          <p class="m-0 text-sm font-semibold">
            {{ order.assetName }}
          </p>
          <p v-if="!order.assetHistory.length" class="m-0 text-sm">
            This is the first job on it.
          </p>
          <ul v-else class="m-0 flex list-none flex-col gap-1.5 p-0 text-sm leading-snug">
            <li v-for="past in order.assetHistory" :key="past.id">
              <NuxtLink :to="`/field/work-orders/${past.id}`" class="font-semibold underline underline-offset-2">
                {{ past.id }}
              </NuxtLink>
              {{ past.title }} · {{ past.completedAt ? `done ${dateTime(past.completedAt)}` : statusLabel(past.status) }}<template v-if="past.resolutionNotes">
                — {{ past.resolutionNotes }}
              </template>
            </li>
          </ul>
        </template>
      </section>

      <div v-if="order.photos.length" class="grid grid-cols-3 gap-2">
        <a v-for="photo in order.photos" :key="photo.url" :href="photo.url" target="_blank" rel="noopener" class="block aspect-square overflow-hidden rounded-2xl ring-1 ring-black/10">
          <img :src="photo.url" :alt="photo.name" class="size-full object-cover" loading="lazy">
        </a>
      </div>
      <div v-if="order.signatureUrl" class="rounded-2xl bg-white p-3 ring-1 ring-black/10">
        <img :src="order.signatureUrl" :alt="`Signature${order.signedBy ? ` of ${order.signedBy}` : ''}`" class="max-h-28">
        <div class="text-xs text-[#5d605d]">
          Signed{{ order.signedBy ? ` by ${order.signedBy}` : '' }}
        </div>
      </div>

      <div v-if="isOpen" class="grid grid-cols-2 gap-2">
        <button type="button" class="min-h-12 rounded-full border border-brand-forest bg-card text-sm font-semibold text-brand-forest disabled:opacity-60 dark:text-brand-lime" :disabled="uploading" @click="photoInput?.click()">
          {{ uploading ? 'Uploading…' : 'Add photos' }}
        </button>
        <button type="button" class="min-h-12 rounded-full border border-brand-forest bg-card text-sm font-semibold text-brand-forest dark:text-brand-lime" @click="isSignOpen = true">
          {{ order.signatureUrl ? 'Re-sign' : 'Customer signature' }}
        </button>
        <input ref="photoInput" type="file" accept="image/*" capture="environment" multiple class="hidden" @change="addPhotos">
      </div>

      <section v-if="isOpen" id="finish" class="flex flex-col gap-2 rounded-[20px] bg-card p-4 ring-1 ring-black/10 dark:ring-white/10">
        <Label for="wo-notes" class="text-base font-bold text-foreground">What was done</Label>
        <Textarea id="wo-notes" v-model="notes" rows="3" placeholder="e.g. Resealed the loop and recalibrated LD-2; 10 test passes OK." />
        <Button class="min-h-12" :disabled="busy || order.status === 'unscheduled'" @click="complete">
          Complete work order
        </Button>
      </section>
      <section v-else class="rounded-[20px] bg-card p-4 text-sm ring-1 ring-black/10 dark:ring-white/10">
        <b class="text-foreground">{{ statusLabel(order.status) }}</b><template v-if="order.completedAt">
          {{ dateTime(order.completedAt) }}
        </template><template v-if="order.resolutionNotes">
          — {{ order.resolutionNotes }}
        </template>
        <Button v-if="isDispatcher" variant="outline" size="sm" class="mt-2" @click="patch({ action: 'reopen' }, 'Reopened')">
          Reopen
        </Button>
      </section>

      <Button v-if="isDispatcher && isOpen" variant="ghost" class="self-center text-destructive hover:text-destructive" @click="patch({ action: 'cancel' }, 'Work order cancelled')">
        Cancel work order
      </Button>
    </template>

    <p v-else class="text-sm text-muted-foreground">
      Loading…
    </p>

    <Dialog v-model:open="isSignOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Customer signature</DialogTitle>
          <DialogDescription>Ask the customer to confirm the work is done.</DialogDescription>
        </DialogHeader>
        <div class="flex flex-col gap-3">
          <Input v-model="signedBy" placeholder="Name of the person signing" aria-label="Signed by" />
          <FieldSignaturePad @save="saveSignature" />
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
