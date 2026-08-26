<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import type { Client } from '~/types/client'
import { computed } from 'vue'
import DataTableFacetedFilter from '~/components/data-table/DataTableFacetedFilter.vue'
import DataTableViewOptions from '~/components/data-table/DataTableViewOptions.vue'
import { stages } from '../data'

interface DataTableToolbarProps {
  table: Table<Client>
}

const props = defineProps<DataTableToolbarProps>()

const isFiltered = computed(() => props.table.getState().columnFilters.length > 0)

const { staff, fetchStaff } = useStaff()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
})

const assigneeOptions = computed(() => [
  { label: 'Unassigned', value: 'unassigned' },
  ...staff.value.map(member => ({ label: member.name, value: member.id })),
])
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-1 flex-wrap items-center gap-2">
      <Input
        placeholder="Filter clients..."
        :model-value="(table.getColumn('name')?.getFilterValue() as string) ?? ''"
        class="h-8 w-[150px] lg:w-[250px]"
        @input="table.getColumn('name')?.setFilterValue(($event.target as HTMLInputElement).value)"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('stage')"
        :column="table.getColumn('stage')"
        title="Stage"
        :options="stages"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('assignees')"
        :column="table.getColumn('assignees')"
        title="Assignee"
        :options="assigneeOptions"
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
