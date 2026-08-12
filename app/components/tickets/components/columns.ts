import type { ColumnDef } from '@tanstack/vue-table'
import type { Ticket } from '~/types/ticket'
import { h } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { priorities, statuses } from '../data/data'
import DataTableColumnHeader from './DataTableColumnHeader.vue'

export const columns: ColumnDef<Ticket>[] = [
  {
    id: 'select',
    header: ({ table }) => h(Checkbox, {
      'checked': table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate'),
      'onUpdate:checked': (value: boolean) => table.toggleAllPageRowsSelected(!!value),
      'ariaLabel': 'Select all',
      'class': 'translate-y-0.5',
      'onClick': (e: Event) => e.stopPropagation(),
    }),
    cell: ({ row }) => h(Checkbox, {
      'checked': row.getIsSelected(),
      'onUpdate:checked': (value: boolean) => row.toggleSelected(!!value),
      'ariaLabel': 'Select row',
      'class': 'translate-y-0.5',
      'onClick': (e: Event) => e.stopPropagation(),
    }),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'id',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Ticket' }),
    cell: ({ row }) => h('div', { class: 'w-24 font-mono text-xs' }, row.getValue('id')),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'subject',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Subject' }),
    cell: ({ row }) => {
      const category = row.original.category

      return h('div', { class: 'flex space-x-2' }, [
        category ? h(Badge, { variant: 'outline' }, () => category) : null,
        h('span', { class: 'max-w-[400px] truncate font-medium' }, row.getValue('subject')),
      ])
    },
  },
  {
    accessorKey: 'requester',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Requester' }),
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.getValue('requester')),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Status' }),
    cell: ({ row }) => {
      const status = statuses.find(
        status => status.value === row.getValue('status'),
      )

      if (!status)
        return null

      return h('div', { class: 'flex w-[110px] items-center' }, [
        status.icon && h(status.icon, { class: 'mr-2 h-4 w-4 text-muted-foreground' }),
        h('span', status.label),
      ])
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'priority',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Priority' }),
    cell: ({ row }) => {
      const priority = priorities.find(
        priority => priority.value === row.getValue('priority'),
      )

      if (!priority)
        return null

      return h('div', { class: 'flex items-center' }, [
        priority.icon && h(priority.icon, { class: 'mr-2 h-4 w-4 text-muted-foreground' }),
        h('span', {}, priority.label),
      ])
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Created' }),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, new Date(row.getValue('createdAt')).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })),
  },
]
