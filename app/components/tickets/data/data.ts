import { Icon } from '#components'
import { h } from 'vue'

export const statuses = [
  {
    value: 'open',
    label: 'Open',
    icon: h(Icon, { name: 'i-lucide-circle-dot' }),
  },
  {
    value: 'in-progress',
    label: 'In Progress',
    icon: h(Icon, { name: 'i-lucide-clock' }),
  },
  {
    value: 'resolved',
    label: 'Resolved',
    icon: h(Icon, { name: 'i-lucide-check-circle-2' }),
  },
  {
    value: 'closed',
    label: 'Closed',
    icon: h(Icon, { name: 'i-lucide-x-circle' }),
  },
]

export const priorities = [
  {
    value: 'low',
    label: 'Low',
    icon: h(Icon, { name: 'i-lucide-arrow-down' }),
  },
  {
    value: 'medium',
    label: 'Medium',
    icon: h(Icon, { name: 'i-lucide-arrow-right' }),
  },
  {
    value: 'high',
    label: 'High',
    icon: h(Icon, { name: 'i-lucide-arrow-up' }),
  },
  {
    value: 'urgent',
    label: 'Urgent',
    icon: h(Icon, { name: 'i-lucide-flame' }),
  },
]
