<script setup lang="ts">
import type { Journey, JourneyStatus } from '~/types/marketing'
import { toast } from 'vue-sonner'

definePageMeta({ middleware: 'bd' })

const route = useRoute()
const journeys = ref<Journey[]>([])
const loading = ref(true)
const isNewOpen = ref(false)
onMounted(async () => {
  try {
    journeys.value = (await fetchUntyped<{ journeys: Journey[] }>('/api/marketing/journeys')).journeys
  }
  finally {
    loading.value = false
  }
  if (typeof route.query.segment === 'string')
    isNewOpen.value = true
})

const newName = ref('')
async function create() {
  try {
    const { journey } = await fetchUntyped<{ journey: Journey }>('/api/marketing/journeys', { method: 'POST', body: { name: newName.value } })
    if (typeof route.query.segment === 'string')
      await fetchUntyped(`/api/marketing/journeys/${journey.id}`, { method: 'PATCH', body: { segmentId: route.query.segment } })
    await navigateTo(`/marketing/journeys/${journey.id}`)
  }
  catch (error: any) {
    toast.error('Could not create the journey', { description: error?.data?.statusMessage })
  }
}

const STATUS_CLASS: Record<JourneyStatus, string> = {
  draft: 'bg-brand-fog text-brand-forest',
  active: 'bg-brand-forest text-brand-lime',
  paused: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
}
const openRate = (j: Journey) => j.stats.sent ? `${Math.round((j.stats.opened / j.stats.sent) * 100)}%` : '—'
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <MarketingNav />
    <PageActions label="Journey actions">
      <Button variant="lime" @click="isNewOpen = true">
        <Icon name="i-lucide-plus" /> New journey
      </Button>
    </PageActions>
    <PageTitle title="Journeys" description="Automated email sequences for a segment or for new website demo requests, with waits, branches and a hand-off to Sales." />

    <div class="rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Journey</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead class="text-right">
              In journey
            </TableHead>
            <TableHead class="text-right">
              Emails sent
            </TableHead>
            <TableHead class="text-right">
              Opened
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="journey in journeys" :key="journey.id" class="cursor-pointer" @click="navigateTo(`/marketing/journeys/${journey.id}`)">
            <TableCell>
              <NuxtLink :to="`/marketing/journeys/${journey.id}`" class="font-semibold text-foreground hover:underline" @click.stop>
                {{ journey.name }}
              </NuxtLink>
            </TableCell>
            <TableCell>
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold capitalize" :class="STATUS_CLASS[journey.status]">{{ journey.status }}</span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ journey.trigger === 'demo_request' ? 'Website demo requests' : (journey.segmentName ?? 'No segment yet') }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ journey.stats.active }} <span class="text-muted-foreground">/ {{ journey.stats.enrolled }}</span>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ journey.stats.sent }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ openRate(journey) }}
            </TableCell>
          </TableRow>
          <TableRow v-if="!journeys.length">
            <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
              {{ loading ? 'Loading…' : 'No journeys yet.' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="isNewOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New journey</DialogTitle>
          <DialogDescription>It starts as a draft with a welcome email. Nothing is sent until you publish.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="create">
          <Input v-model="newName" placeholder="e.g. Demo request nurture" aria-label="Journey name" autofocus />
          <DialogFooter>
            <Button type="submit" :disabled="!newName.trim()">
              Create journey
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
