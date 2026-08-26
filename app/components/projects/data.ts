import { Icon } from '#components'
import { h } from 'vue'

export const projectStatuses = [
  {
    value: 'planned',
    label: 'Planned',
    icon: h(Icon, { name: 'i-lucide-calendar' }),
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  },
  {
    value: 'active',
    label: 'Active',
    icon: h(Icon, { name: 'i-lucide-play' }),
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  },
  {
    value: 'on_hold',
    label: 'On Hold',
    icon: h(Icon, { name: 'i-lucide-pause' }),
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  },
  {
    value: 'completed',
    label: 'Completed',
    icon: h(Icon, { name: 'i-lucide-check-circle-2' }),
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    icon: h(Icon, { name: 'i-lucide-x-circle' }),
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  },
]

export const currencies = [
  { value: 'GHS', label: 'GHS — Ghanaian Cedi', symbol: 'GH₵' },
  { value: 'USD', label: 'USD — US Dollar', symbol: '$' },
  { value: 'EUR', label: 'EUR — Euro', symbol: '€' },
  { value: 'GBP', label: 'GBP — British Pound', symbol: '£' },
  { value: 'NGN', label: 'NGN — Nigerian Naira', symbol: '₦' },
]
