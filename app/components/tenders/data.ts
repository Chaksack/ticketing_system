import { Icon } from '#components'
import { h } from 'vue'
import { TENDER_STAGE_PROBABILITY } from '~/types/tender'

export const tenderStages = [
  {
    value: 'identified',
    label: 'Identified',
    icon: h(Icon, { name: 'i-lucide-search' }),
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
    probability: TENDER_STAGE_PROBABILITY.identified,
  },
  {
    value: 'registered',
    label: 'Registered',
    icon: h(Icon, { name: 'i-lucide-clipboard-check' }),
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
    probability: TENDER_STAGE_PROBABILITY.registered,
  },
  {
    value: 'preparing',
    label: 'Preparing Bid',
    icon: h(Icon, { name: 'i-lucide-file-edit' }),
    badgeClass: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30',
    probability: TENDER_STAGE_PROBABILITY.preparing,
  },
  {
    value: 'submitted',
    label: 'Submitted',
    icon: h(Icon, { name: 'i-lucide-send' }),
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
    probability: TENDER_STAGE_PROBABILITY.submitted,
  },
  {
    value: 'evaluation',
    label: 'Under Evaluation',
    icon: h(Icon, { name: 'i-lucide-scale' }),
    badgeClass: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-400 dark:border-cyan-500/30',
    probability: TENDER_STAGE_PROBABILITY.evaluation,
  },
  {
    value: 'won',
    label: 'Won',
    icon: h(Icon, { name: 'i-lucide-trophy' }),
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
    probability: TENDER_STAGE_PROBABILITY.won,
  },
  {
    value: 'lost',
    label: 'Lost',
    icon: h(Icon, { name: 'i-lucide-x-circle' }),
    badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
    probability: TENDER_STAGE_PROBABILITY.lost,
  },
]
