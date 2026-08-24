import type { AutomationRule } from '~/types/automation'

export interface NewAutomationRule {
  name: string
  field: AutomationRule['field']
  operator: AutomationRule['operator']
  value: string
  setPriority?: AutomationRule['setPriority']
  setStatus?: AutomationRule['setStatus']
  setAssigneeId?: string
  addTagId?: string
}

export function useAutomationRules() {
  const rules = useState<AutomationRule[]>('automation-rules-list', () => [])

  async function fetchRules() {
    const { rules: rows } = await $fetch('/api/automation-rules')
    rules.value = rows
  }

  async function addRule(payload: NewAutomationRule) {
    const { rule } = await $fetch('/api/automation-rules', { method: 'POST', body: payload })
    rules.value.push(rule)
    return rule
  }

  async function setRuleEnabled(id: string, enabled: boolean) {
    const { rule } = await $fetch(`/api/automation-rules/${id}`, { method: 'PATCH', body: { enabled } })
    const index = rules.value.findIndex(r => r.id === id)
    if (index !== -1)
      rules.value[index] = rule
    return rule
  }

  async function removeRule(id: string) {
    await $fetch(`/api/automation-rules/${id}`, { method: 'DELETE' })
    rules.value = rules.value.filter(r => r.id !== id)
  }

  return { rules, fetchRules, addRule, setRuleEnabled, removeRule }
}
