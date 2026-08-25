import { Icon } from '#components'
import { h } from 'vue'

export const statuses = [
  {
    value: 'open',
    label: 'Open',
    icon: h(Icon, { name: 'i-lucide-circle-dot' }),
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  },
  {
    value: 'in-progress',
    label: 'In Progress',
    icon: h(Icon, { name: 'i-lucide-clock' }),
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  },
  {
    value: 'resolved',
    label: 'Resolved',
    icon: h(Icon, { name: 'i-lucide-check-circle-2' }),
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  },
  {
    value: 'closed',
    label: 'Closed',
    icon: h(Icon, { name: 'i-lucide-x-circle' }),
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  },
]

export const priorities = [
  {
    value: 'low',
    label: 'Low',
    icon: h(Icon, { name: 'i-lucide-arrow-down' }),
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: h(Icon, { name: 'i-lucide-arrow-right' }),
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  },
  {
    value: 'high',
    label: 'High',
    icon: h(Icon, { name: 'i-lucide-arrow-up' }),
    badgeClass: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/30',
  },
  {
    value: 'urgent',
    label: 'Urgent',
    icon: h(Icon, { name: 'i-lucide-flame' }),
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  },
]
