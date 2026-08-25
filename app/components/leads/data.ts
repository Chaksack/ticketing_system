import { Icon } from '#components'
import { h } from 'vue'

export const leadStages = [
  { value: 'new', label: 'New', icon: h(Icon, { name: 'i-lucide-star' }) },
  { value: 'contacted', label: 'Contacted', icon: h(Icon, { name: 'i-lucide-phone' }) },
  { value: 'qualified', label: 'Qualified', icon: h(Icon, { name: 'i-lucide-badge-check' }) },
  { value: 'proposal', label: 'Proposal Sent', icon: h(Icon, { name: 'i-lucide-file-text' }) },
  { value: 'won', label: 'Won', icon: h(Icon, { name: 'i-lucide-trophy' }) },
  { value: 'lost', label: 'Lost', icon: h(Icon, { name: 'i-lucide-x-circle' }) },
]
