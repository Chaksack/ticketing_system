<script setup lang="ts">
import type { Invoice } from '~/types/invoice'
import DataTable from '~/components/data-table/DataTable.vue'
import { columns } from '~/components/invoices/columns'
import DataTableToolbar from '~/components/invoices/DataTableToolbar.vue'
import InvoiceDetailSheet from '~/components/invoices/InvoiceDetailSheet.vue'

definePageMeta({
  middleware: 'bd',
})

const { invoices, balanceByCurrency, fetchInvoices } = useInvoices()

onMounted(() => {
  fetchInvoices()
})

const isDetailOpen = ref(false)
const selectedInvoiceId = ref<string | null>(null)
const selectedInvoice = computed(() => invoices.value.find(i => i.id === selectedInvoiceId.value) ?? null)

function openInvoice(invoice: Invoice) {
  selectedInvoiceId.value = invoice.id
  isDetailOpen.value = true
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Invoices
      </h2>
      <p class="text-muted-foreground">
        Every invoice across every client — record payments and track balances from one place.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <Badge v-for="row in balanceByCurrency" :key="row.currency" variant="outline" class="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30">
        Outstanding: {{ row.balance.toLocaleString() }} {{ row.currency }}
      </Badge>
      <Badge v-if="!balanceByCurrency.length" variant="outline">
        No outstanding balance
      </Badge>
    </div>

    <DataTable :data="invoices" :columns="columns" @select="openInvoice">
      <template #toolbar="{ table }">
        <DataTableToolbar :table="table" />
      </template>
    </DataTable>

    <InvoiceDetailSheet v-model:open="isDetailOpen" :invoice="selectedInvoice" />
  </div>
</template>
