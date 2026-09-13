<script setup lang="ts">
import type { VendorBill } from '~/types/vendor-bill'
import DataTable from '~/components/data-table/DataTable.vue'
import { columns } from '~/components/vendor-bills/columns'
import DataTableToolbar from '~/components/vendor-bills/DataTableToolbar.vue'
import VendorBillDetailSheet from '~/components/vendor-bills/VendorBillDetailSheet.vue'

definePageMeta({
  middleware: 'finance',
})

const { bills, outstandingByCurrency, fetchBills } = useVendorBills()

onMounted(() => {
  fetchBills()
})

const isDetailOpen = ref(false)
const selectedBillId = ref<string | null>(null)
const selectedBill = computed(() => bills.value.find(b => b.id === selectedBillId.value) ?? null)

function openBill(bill: VendorBill) {
  selectedBillId.value = bill.id
  isDetailOpen.value = true
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Vendor Bills
      </h2>
      <p class="text-muted-foreground">
        Every bill across every vendor — record payments and track what's owed from one place.
      </p>
    </div>

    <div class="flex flex-wrap gap-2">
      <Badge v-for="row in outstandingByCurrency" :key="row.currency" variant="outline" class="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30">
        Owed: {{ row.balance.toLocaleString() }} {{ row.currency }}
      </Badge>
      <Badge v-if="!outstandingByCurrency.length" variant="outline">
        No outstanding balance
      </Badge>
    </div>

    <DataTable :data="bills" :columns="columns" @select="openBill">
      <template #toolbar="{ table }">
        <DataTableToolbar :table="table" />
      </template>
    </DataTable>

    <VendorBillDetailSheet v-model:open="isDetailOpen" :bill="selectedBill" />
  </div>
</template>
