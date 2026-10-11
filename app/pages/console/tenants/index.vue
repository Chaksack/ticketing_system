<script setup lang="ts">
import type { TenantSummary } from '~/types/organization'
import { ORG_APPS, ORG_PLANS } from '~/types/organization'

definePageMeta({ middleware: 'platform' })

const { fetchTenants } = useConsole()
const tenants = ref<TenantSummary[] | null>(null)
const search = ref('')
const statusFilter = ref<'all' | 'active' | 'suspended'>('all')

onMounted(async () => {
  tenants.value = await fetchTenants()
})

const filtered = computed(() => (tenants.value ?? []).filter((tenant) => {
  if (statusFilter.value !== 'all' && tenant.status !== statusFilter.value)
    return false
  const q = search.value.trim().toLowerCase()
  return !q || tenant.name.toLowerCase().includes(q) || tenant.slug.includes(q)
}))

function appLabels(tenant: TenantSummary) {
  return ORG_APPS.filter(app => tenant.apps.includes(app.id)).map(app => app.label).join(', ')
}

function planLabel(plan: string) {
  return ORG_PLANS.find(p => p.id === plan)?.label ?? plan
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <div>
      <div class="text-sm text-muted-foreground">
        Canopy staff console
      </div>
      <h2 class="text-3xl font-black tracking-[-0.04em] text-foreground">
        Tenants
      </h2>
      <p class="text-muted-foreground">
        Every company on Canopy. Each has its own database; counts are read live.
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="relative min-w-[220px] max-w-sm flex-1">
        <Icon name="i-lucide-search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="search" placeholder="Find a tenant by name or address…" class="pl-9" aria-label="Find a tenant" />
      </div>
      <Select v-model="statusFilter">
        <SelectTrigger class="w-40" aria-label="Status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All statuses
          </SelectItem>
          <SelectItem value="active">
            Active
          </SelectItem>
          <SelectItem value="suspended">
            Suspended
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="overflow-x-auto rounded-3xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Apps</TableHead>
            <TableHead class="text-right">
              Staff
            </TableHead>
            <TableHead class="text-right">
              Open tickets
            </TableHead>
            <TableHead>Joined</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!tenants">
            <TableCell :colspan="7" class="h-20 text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!filtered.length">
            <TableCell :colspan="7" class="h-20 text-center text-muted-foreground">
              No tenants match.
            </TableCell>
          </TableRow>
          <TableRow v-for="tenant in filtered" :key="tenant.id">
            <TableCell>
              <NuxtLink :to="`/console/tenants/${tenant.id}`" class="font-semibold hover:underline">
                {{ tenant.name }}
              </NuxtLink>
              <div class="text-xs text-muted-foreground">
                {{ tenant.slug }}<template v-if="tenant.isHome">
                  · Canopy's own workspace
                </template><template v-else>
                  · {{ tenant.source === 'self_serve' ? 'Self-serve' : 'Staff-led' }}
                </template>
              </div>
            </TableCell>
            <TableCell>{{ planLabel(tenant.plan) }}</TableCell>
            <TableCell class="max-w-[16rem] truncate text-muted-foreground">
              {{ appLabels(tenant) }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ tenant.staffCount ?? '—' }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ tenant.openTicketCount ?? '—' }}
            </TableCell>
            <TableCell class="whitespace-nowrap text-muted-foreground">
              {{ formatDate(tenant.createdAt) }}
            </TableCell>
            <TableCell>
              <ConsoleStatusBadge :status="tenant.status" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
