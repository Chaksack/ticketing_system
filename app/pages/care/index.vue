<script setup lang="ts">
import type { CareEngagement } from '~/types/care'
import type { TenantSummary } from '~/types/organization'
import { toast } from 'vue-sonner'
import { CARE_MODELS, CARE_STAGES } from '~/types/care'

definePageMeta({ middleware: 'platform' })

const engagements = ref<CareEngagement[]>([])
const tenants = ref<TenantSummary[]>([])
const loading = ref(true)
onMounted(async () => {
  try {
    engagements.value = (await fetchUntyped<{ engagements: CareEngagement[] }>('/api/care/engagements')).engagements
    tenants.value = (await fetchUntyped<{ tenants: TenantSummary[] }>('/api/console/tenants')).tenants
  }
  finally {
    loading.value = false
  }
})
const available = computed(() => tenants.value.filter(t => !t.isHome && !engagements.value.some(e => e.orgId === t.id)))

const isNewOpen = ref(false)
const orgId = ref('')
async function create() {
  try {
    const { engagement } = await fetchUntyped<{ engagement: CareEngagement }>('/api/care/engagements', { method: 'POST', body: { orgId: orgId.value } })
    await navigateTo(`/care/engagements/${engagement.id}`)
  }
  catch (error: any) {
    toast.error('Could not start the engagement', { description: error?.data?.statusMessage })
  }
}
const stageLabel = (s: string) => CARE_STAGES.find(x => x.value === s)?.label ?? 'Ended'
const modelLabel = (m: string) => CARE_MODELS.find(x => x.value === m)?.label ?? m
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <CareNav />
    <PageActions label="Care actions">
      <Button variant="lime" @click="isNewOpen = true">
        <Icon name="i-lucide-plus" /> New engagement
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/care-service" target="_blank">
          Service page
        </NuxtLink>
      </Button>
    </PageActions>
    <PageTitle title="Canopy Care" description="Clients whose customer service Canopy runs, inside their own workspace." />

    <div class="rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Channels</TableHead>
            <TableHead class="text-right">
              Agents
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="engagement in engagements" :key="engagement.id" class="cursor-pointer" @click="navigateTo(`/care/engagements/${engagement.id}`)">
            <TableCell class="font-semibold text-foreground">
              {{ engagement.orgName ?? engagement.orgId }}
            </TableCell>
            <TableCell>
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="engagement.stage === 'live' ? 'bg-brand-forest text-brand-lime' : 'bg-brand-mist text-brand-forest'">{{ stageLabel(engagement.stage) }}</span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ modelLabel(engagement.model) }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ engagement.channels.join(', ') }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ engagement.agentIds.length }}
            </TableCell>
          </TableRow>
          <TableRow v-if="!engagements.length">
            <TableCell :colspan="5" class="h-24 text-center text-muted-foreground">
              {{ loading ? 'Loading…' : 'No Care engagements yet.' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="isNewOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Canopy Care engagement</DialogTitle>
          <DialogDescription>For an existing Canopy client. Their customers and conversations stay in their own workspace.</DialogDescription>
        </DialogHeader>
        <Select v-model="orgId">
          <SelectTrigger class="w-full" aria-label="Client">
            <SelectValue :placeholder="available.length ? 'Choose a client' : 'Every client already has one'" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="tenant in available" :key="tenant.id" :value="tenant.id">
              {{ tenant.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <DialogFooter>
          <Button :disabled="!orgId" @click="create">
            Start scoping
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
