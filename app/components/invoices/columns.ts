import type { ColumnDef } from '@tanstack/vue-table'
import type { Invoice, InvoiceStatus } from '~/types/invoice'
import { h } from 'vue'
import { Badge } from '@/components/ui/badge'
import DataTableColumnHeader from '~/components/data-table/DataTableColumnHeader.vue'

const STATUS_BADGE_CLASS: Record<InvoiceStatus, string> = {
  unpaid: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  partial: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}

export const columns: ColumnDef<Invoice>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Invoice' } as any),
    cell: ({ row }) => h('span', { class: 'font-mono text-xs font-medium' }, row.getValue('id')),
  },
  {
    accessorKey: 'clientName',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Client' } as any),
    cell: ({ row }) => h('span', { class: 'font-medium' }, row.getValue('clientName') || '—'),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Status' } as any),
    cell: ({ row }) => {
      const status = row.getValue('status') as InvoiceStatus
      return h(Badge, { variant: 'outline', class: STATUS_BADGE_CLASS[status] }, () => status)
    },
    filterFn: (row, id, value) => {
      return value.includes(row.getValue(id))
    },
  },
  {
    accessorKey: 'total',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Total' } as any),
    cell: ({ row }) => h('span', { class: 'tabular-nums' }, `${(row.getValue('total') as number).toLocaleString()} ${row.original.currency}`),
  },
  {
    accessorKey: 'amountPaid',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Paid' } as any),
    cell: ({ row }) => h('span', { class: 'tabular-nums text-muted-foreground' }, (row.getValue('amountPaid') as number).toLocaleString()),
  },
  {
    accessorKey: 'balance',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Balance' } as any),
    cell: ({ row }) => h('span', { class: 'tabular-nums font-medium' }, (row.getValue('balance') as number).toLocaleString()),
  },
  {
    accessorKey: 'dueAt',
    header: ({ column }) => h(DataTableColumnHeader, { column, title: 'Due' } as any),
    cell: ({ row }) => h('span', { class: 'text-sm text-muted-foreground' }, formatDate(row.getValue('dueAt'))),
  },
]
