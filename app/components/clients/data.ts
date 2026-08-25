import { Icon } from '#components'
import { h } from 'vue'

export const stages = [
  { value: 'lead', label: 'Lead', icon: h(Icon, { name: 'i-lucide-sparkles' }) },
  { value: 'contacted', label: 'Contacted', icon: h(Icon, { name: 'i-lucide-phone' }) },
  { value: 'proposal', label: 'Proposal Sent', icon: h(Icon, { name: 'i-lucide-file-text' }) },
  { value: 'negotiation', label: 'Negotiation', icon: h(Icon, { name: 'i-lucide-handshake' }) },
  { value: 'active', label: 'Active', icon: h(Icon, { name: 'i-lucide-check-circle-2' }) },
  { value: 'lost', label: 'Lost', icon: h(Icon, { name: 'i-lucide-x-circle' }) },
]
