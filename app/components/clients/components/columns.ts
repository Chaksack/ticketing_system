import type { ColumnDef } from '@tanstack/vue-table'
import type { Client } from '~/types/client'
import { h } from 'vue'
import { Badge } from '@/components/ui/badge'
import DataTableColumnHeader from '~/components/data-table/DataTableColumnHeader.vue'
import { stages } from '../data'

export const columns: ColumnDef<Client>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Name' } as any),
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.getValue('name')),
  },
  {
    id: 'contact',
    accessorFn: row => row.contactName || row.contactEmail || '',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Contact' } as any),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, (row.getValue('contact') as string) || '—'),
  },
  {
    accessorKey: 'stage',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Stage' } as any),
    cell: ({ row }) => {
      const stage = stages.find(s => s.value === row.getValue('stage'))
      if (!stage)
        return null

      return h(Badge, { variant: 'outline', class: stage.badgeClass }, () => stage.label)
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'assignees',
    accessorFn: row => row.assignees.length ? row.assignees.map(a => a.id) : ['unassigned'],
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Assigned To' } as any),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, row.original.assignees.length ? row.original.assignees.map(a => a.name).join(', ') : 'Unassigned'),
    filterFn: (row, id, value: string[]) => {
      const ids = row.getValue(id) as string[]
      return value.some(v => ids.includes(v))
    },
    enableSorting: false,
  },
  {
    id: 'activeContractCount',
    accessorFn: row => row.activeContractCount ?? 0,
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Active AMC' } as any),
    cell: ({ row }) => h('span', {}, String(row.getValue('activeContractCount'))),
  },
]
