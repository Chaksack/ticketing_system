export type UtilizationStatus = 'under' | 'balanced' | 'over'

export interface ResourceUtilizationRow {
  staffId: string
  staffName: string
  hoursLogged: number
  capacityHours: number
  utilizationPct: number
  status: UtilizationStatus
}
