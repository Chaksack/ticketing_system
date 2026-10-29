<script setup lang="ts">
import type { SupportCustomer } from '~/types/supportDesk'

// Support desk → Customers: everyone who has raised a ticket or started a chat, with their history
// at a glance. Matched to a client company by email.
definePageMeta({ middleware: 'agent' })

const customers = ref<SupportCustomer[] | null>(null)
const search = ref('')
const view = ref<'all' | 'open' | 'companies' | 'unmatched'>('all')

const load = useDebounceFn(async () => {
  customers.value = (await fetchUntyped<{ customers: SupportCustomer[] }>('/api/service/customers', { query: { q: search.value || undefined } })).customers
}, 250)
onMounted(load)
watch(search, load)

const tabs = computed(() => ([
  { value: 'all', label: 'Everyone' },
  { value: 'open', label: 'With open cases' },
  { value: 'companies', label: 'From a client' },
  { value: 'unmatched', label: 'Not matched' },
] as const).map(tab => ({ ...tab, count: (customers.value ?? []).filter(c => matches(c, tab.value)).length })))
function matches(customer: SupportCustomer, filter: typeof view.value) {
  return filter === 'all' || (filter === 'open' ? customer.openTickets > 0 : filter === 'companies' ? !!customer.clientId : !customer.clientId)
}
const shown = computed(() => (customers.value ?? []).filter(c => matches(c, view.value)))
const when = (iso: string) => new Date(iso).toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const initials = (name: string) => name.split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase()
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="Customers" description="Everyone who has contacted support — by ticket, email or chat — with their cases, chats and satisfaction.">
      <template #aside>
        <PageSegmentedTabs v-model="view" label="Customers" :options="tabs" />
      </template>
    </PageTitle>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="search" placeholder="Find by name, email or company…" class="pl-9" aria-label="Find a customer" />
    </div>

    <div class="overflow-x-auto rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Company</TableHead>
            <TableHead class="text-right">
              Cases
            </TableHead>
            <TableHead class="text-right">
              Open
            </TableHead>
            <TableHead class="text-right">
              Chats
            </TableHead>
            <TableHead class="text-right">
              Rating
            </TableHead>
            <TableHead>Last contact</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!customers">
            <TableCell :colspan="7" class="h-20 text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!shown.length">
            <TableCell :colspan="7" class="h-24 text-center text-muted-foreground">
              {{ search ? 'No customer matches.' : 'No customers yet — they appear when someone raises a ticket or starts a chat.' }}
            </TableCell>
          </TableRow>
          <TableRow v-for="customer in shown" :key="customer.email" class="cursor-pointer" @click="navigateTo(`/service/customers/${encodeURIComponent(customer.email)}`)">
            <TableCell>
              <div class="flex items-center gap-3">
                <span aria-hidden="true" class="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-mist text-xs font-bold text-brand-forest">{{ initials(customer.name) }}</span>
                <div class="min-w-0">
                  <div class="font-semibold text-foreground">
                    {{ customer.name }}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {{ customer.email }}
                  </div>
                </div>
              </div>
            </TableCell>
            <TableCell class="text-sm">
              {{ customer.clientName ?? '—' }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ customer.ticketCount }}
            </TableCell>
            <TableCell class="text-right tabular-nums" :class="customer.openTickets ? 'font-bold text-foreground' : 'text-muted-foreground'">
              {{ customer.openTickets }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ customer.chatCount }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ customer.rating ? `${customer.rating.toFixed(1)} / 5` : '—' }}
            </TableCell>
            <TableCell class="whitespace-nowrap text-sm text-muted-foreground">
              {{ when(customer.lastContactAt) }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
