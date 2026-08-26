import type { AmcContract, AmcContractDisplayStatus } from '../types/amc'

const EXPIRING_SOON_DAYS = 30

export function getContractDisplayStatus(contract: Pick<AmcContract, 'status' | 'endDate'>): AmcContractDisplayStatus {
  if (contract.status !== 'active')
    return contract.status

  const now = Date.now()
  const end = new Date(contract.endDate).getTime()

  if (now > end)
    return 'expired'

  const daysRemaining = (end - now) / (24 * 60 * 60 * 1000)
  if (daysRemaining <= EXPIRING_SOON_DAYS)
    return 'expiring'

  return 'active'
}
