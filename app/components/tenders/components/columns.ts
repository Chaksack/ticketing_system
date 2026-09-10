import type { ColumnDef } from '@tanstack/vue-table'
import type { Tender } from '~/types/tender'
import { h } from 'vue'
import { Badge } from '@/components/ui/badge'
import DataTableColumnHeader from '~/components/data-table/DataTableColumnHeader.vue'
import { tenderStages } from '../data'

const CONVERTED_BADGE_CLASS = 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30'

function formatDeadline(value?: string) {
  if (!value)
    return '—'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export const columns: ColumnDef<Tender>[] = [
  {
    accessorKey: 'title',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Title' } as any),
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.getValue('title')),
  },
  {
    id: 'issuingAuthority',
    accessorFn: row => row.issuingAuthority || '',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Issuing Authority' } as any),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, (row.getValue('issuingAuthority') as string) || '—'),
  },
  {
    accessorKey: 'stage',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Stage' } as any),
    cell: ({ row }) => {
      if (row.original.convertedClientId)
        return h(Badge, { variant: 'outline', class: CONVERTED_BADGE_CLASS }, () => 'Converted')

      const stage = tenderStages.find(s => s.value === row.getValue('stage'))
      if (!stage)
        return null

      return h(Badge, { variant: 'outline', class: stage.badgeClass }, () => stage.label)
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    id: 'submissionDeadline',
    accessorFn: row => row.submissionDeadline || '',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Deadline' } as any),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, formatDeadline(row.original.submissionDeadline)),
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
