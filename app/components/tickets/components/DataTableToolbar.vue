<script setup lang="ts">
import type { Table } from '@tanstack/vue-table'
import type { Ticket } from '~/types/ticket'
import { computed } from 'vue'
import { priorities, statuses } from '../data/data'
import DataTableFacetedFilter from './DataTableFacetedFilter.vue'
import DataTableViewOptions from './DataTableViewOptions.vue'

interface DataTableToolbarProps {
  table: Table<Ticket>
}

const props = defineProps<DataTableToolbarProps>()

const isFiltered = computed(() => props.table.getState().columnFilters.length > 0)

const { staff, fetchStaff } = useStaff()
const { tags, fetchTags } = useTags()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
  if (!tags.value.length)
    fetchTags()
})

const assigneeOptions = computed(() => [
  { label: 'Unassigned', value: 'unassigned' },
  ...staff.value.map(member => ({ label: member.name, value: member.id })),
])

const tagOptions = computed(() => tags.value.map(tag => ({ label: tag.name, value: tag.id })))
</script>

<template>
  <div class="flex flex-wrap items-center justify-between gap-2">
    <div class="flex flex-1 flex-wrap items-center gap-2">
      <Input
        placeholder="Filter tickets..."
        :model-value="(table.getColumn('subject')?.getFilterValue() as string) ?? ''"
        class="h-8 w-[150px] lg:w-[250px]"
        @input="table.getColumn('subject')?.setFilterValue(($event.target as HTMLInputElement).value)"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('status')"
        :column="table.getColumn('status')"
        title="Status"
        :options="statuses"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('priority')"
        :column="table.getColumn('priority')"
        title="Priority"
        :options="priorities"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('assigneeId')"
        :column="table.getColumn('assigneeId')"
        title="Assignee"
        :options="assigneeOptions"
      />
      <DataTableFacetedFilter
        v-if="table.getColumn('tags') && tagOptions.length"
        :column="table.getColumn('tags')"
        title="Tags"
        :options="tagOptions"
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
