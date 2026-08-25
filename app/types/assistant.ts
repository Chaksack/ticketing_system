export interface AssistantStat {
  label: string
  value: string | number
}

export interface AssistantTable {
  headers: string[]
  rows: (string | number)[][]
}

export interface AssistantSection {
  heading?: string
  stats?: AssistantStat[]
  table?: AssistantTable
}
