import type { ColumnDef } from '@tanstack/vue-table'
import type { Lead } from '~/types/lead'
import { h } from 'vue'
import { Badge } from '@/components/ui/badge'
import DataTableColumnHeader from '~/components/data-table/DataTableColumnHeader.vue'
import { leadStages } from '../data'

const CONVERTED_BADGE_CLASS = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'

export const columns: ColumnDef<Lead>[] = [
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
    accessorKey: 'source',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Source' } as any),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, (row.getValue('source') as string) || '—'),
  },
  {
    accessorKey: 'stage',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Stage' } as any),
    cell: ({ row }) => {
      if (row.original.convertedClientId)
        return h(Badge, { variant: 'outline', class: CONVERTED_BADGE_CLASS }, () => 'Converted')

      const stage = leadStages.find(s => s.value === row.getValue('stage'))
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
]
