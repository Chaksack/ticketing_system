import type { RegardingType } from './interaction'

export type SuggestionUrgency = 'none' | 'follow_up' | 'stalled'

export interface OpportunitySuggestion {
  regardingType: RegardingType
  regardingId: string
  winProbability: number | null
  daysSinceLastContact: number | null
  urgency: SuggestionUrgency
  headline: string
  actionLabel: string
  modelTrainedAt: string | null
  trainingExamples: number
  minTrainingExamples: number
}
