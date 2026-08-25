import { Icon } from '#components'
import { h } from 'vue'

export const statuses = [
  {
    value: 'backlog',
    label: 'Backlog',
    icon: h(Icon, { name: 'i-lucide-inbox' }),
  },
  {
    value: 'todo',
    label: 'To Do',
    icon: h(Icon, { name: 'i-lucide-circle-dot' }),
  },
  {
    value: 'in_progress',
    label: 'In Progress',
    icon: h(Icon, { name: 'i-lucide-clock' }),
  },
  {
    value: 'in_review',
    label: 'In Review',
    icon: h(Icon, { name: 'i-lucide-eye' }),
  },
  {
    value: 'done',
    label: 'Done',
    icon: h(Icon, { name: 'i-lucide-check-circle-2' }),
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
]

export const epicColors = [
  '#16a34a',
  '#2563eb',
  '#d97706',
  '#dc2626',
  '#7c3aed',
  '#0891b2',
  '#db2777',
  '#4b5563',
]
