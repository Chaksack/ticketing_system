import type { ColumnDef } from '@tanstack/vue-table'
import type { SlaStatus, Ticket } from '~/types/ticket'
import { h } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { getSlaStatus } from '@/lib/sla'
import { priorities, statuses } from '../data/data'
import DataTableColumnHeader from './DataTableColumnHeader.vue'

const SLA_DOT_CLASS: Record<SlaStatus, string> = {
  'on-track': 'bg-emerald-500',
  'at-risk': 'bg-amber-500',
  'breached': 'bg-destructive',
}

const SLA_LABEL: Record<SlaStatus, string> = {
  'on-track': 'On track',
  'at-risk': 'At risk',
  'breached': 'Breached',
}

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
    id: 'assigneeId',
    accessorFn: row => row.assigneeId ?? 'unassigned',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Assignee' }),
    cell: ({ row }) => h('span', { class: 'text-sm' }, row.original.assigneeName ?? 'Unassigned'),
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'tags',
    accessorFn: row => row.tags.map(tag => tag.id),
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Tags' }),
    cell: ({ row }) => h('div', { class: 'flex flex-wrap gap-1' }, row.original.tags.map(tag =>
      h(Badge, { key: tag.id, variant: 'outline', class: 'text-xs' }, () => tag.name),
    )),
    filterFn: (row, id, value: string[]) => {
      const tagIds = row.getValue(id) as string[]
      return value.some(v => tagIds.includes(v))
    },
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

      return h(Badge, { variant: 'outline', class: status.badgeClass }, () => [
        status.icon && h(status.icon, { class: 'size-3' }),
        status.label,
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

      return h(Badge, { variant: 'outline', class: priority.badgeClass }, () => [
        priority.icon && h(priority.icon, { class: 'size-3' }),
        priority.label,
      ])
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'sla',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'SLA' }),
    cell: ({ row }) => {
      const sla = getSlaStatus(row.original)
      if (!sla)
        return null

      return h('div', { class: 'flex items-center gap-1.5 text-xs text-muted-foreground' }, [
        h('span', { class: `size-2 rounded-full ${SLA_DOT_CLASS[sla]}` }),
        h('span', SLA_LABEL[sla]),
      ])
    },
    enableSorting: false,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Created' }),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, new Date(row.getValue('createdAt')).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })),
  },
]
