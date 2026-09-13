<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import type { VendorBill } from '~/types/vendor-bill'
import { computed } from 'vue'
import DataTableFacetedFilter from '~/components/data-table/DataTableFacetedFilter.vue'
import DataTableViewOptions from '~/components/data-table/DataTableViewOptions.vue'

interface DataTableToolbarProps {
  table: Table<VendorBill>
}

const props = defineProps<DataTableToolbarProps>()

const isFiltered = computed(() => props.table.getState().columnFilters.length > 0)

const statusOptions = [
  { label: 'Unpaid', value: 'unpaid' },
  { label: 'Partial', value: 'partial' },
  { label: 'Paid', value: 'paid' },
]
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-1 flex-wrap items-center gap-2">
      <Input
        placeholder="Filter by vendor..."
        :model-value="(table.getColumn('vendorName')?.getFilterValue() as string) ?? ''"
        class="h-8 w-[150px] lg:w-[250px]"
        @input="table.getColumn('vendorName')?.setFilterValue(($event.target as HTMLInputElement).value)"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('status')"
        :column="table.getColumn('status')"
        title="Status"
        :options="statusOptions"
      />

      <Button
        v-if="isFiltered"
        variant="ghost"
        class="h-8 px-2 lg:px-3"
        @click="table.resetColumnFilters()"
      >
        Reset
        <Icon name="i-radix-icons-cross-2" class="ml-2 h-4 w-4" />
      </Button>
    </div>
    <DataTableViewOptions :table="table" />
  </div>
</template>
