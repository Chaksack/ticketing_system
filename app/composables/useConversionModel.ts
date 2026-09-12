import type { ConversionModelStatus } from '~/types/conversion-model'

export function useConversionModel() {
  const status = useState<ConversionModelStatus | null>('conversion-model-status', () => null)
  const isTraining = useState('conversion-model-training', () => false)

  async function fetchStatus() {
    const { status: result } = await $fetch<{ status: ConversionModelStatus }>('/api/ml/conversion-model/status')
    status.value = result
  }

  async function retrain() {
    isTraining.value = true
    try {
      const { status: result } = await $fetch<{ status: ConversionModelStatus }>('/api/ml/conversion-model/train', { method: 'POST' })
      status.value = result
      return result
    }
    finally {
      isTraining.value = false
    }
  }

  return { status, isTraining, fetchStatus, retrain }
}
