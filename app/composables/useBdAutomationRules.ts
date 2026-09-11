import type { BdAutomationRule } from '~/types/automation'

export interface NewBdAutomationRule {
  name: string
  entityType: BdAutomationRule['entityType']
  trigger: BdAutomationRule['trigger']
  field?: BdAutomationRule['field']
  operator?: BdAutomationRule['operator']
  value?: string
  toStage?: string
  setAssigneeId?: string
  notifyStaffId?: string
}

export function useBdAutomationRules() {
  const rules = useState<BdAutomationRule[]>('bd-automation-rules-list', () => [])

  async function fetchRules() {
    const { rules: rows } = await $fetch('/api/bd-automation-rules')
    rules.value = rows
  }

  async function addRule(payload: NewBdAutomationRule) {
    const { rule } = await $fetch('/api/bd-automation-rules', { method: 'POST', body: payload })
    rules.value.push(rule)
    return rule
  }

  async function setRuleEnabled(id: string, enabled: boolean) {
    const { rule } = await $fetch(`/api/bd-automation-rules/${id}`, { method: 'PATCH', body: { enabled } })
    const index = rules.value.findIndex(r => r.id === id)
    if (index !== -1)
      rules.value[index] = rule
    return rule
  }

  async function removeRule(id: string) {
    await $fetch(`/api/bd-automation-rules/${id}`, { method: 'DELETE' })
    rules.value = rules.value.filter(r => r.id !== id)
  }

  return { rules, fetchRules, addRule, setRuleEnabled, removeRule }
}
