export interface ConversionModelStatus {
  trained: boolean
  trainedAt: string | null
  trainingExamples: number
  minTrainingExamples: number
  accuracy: number | null
}
