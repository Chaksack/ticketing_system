import type { Macro } from '~/types/automation'

export interface NewMacro {
  name: string
  body: string
  setStatus?: Macro['setStatus']
  setPriority?: Macro['setPriority']
  addTagId?: string
}

export function useMacros() {
  const macros = useState<Macro[]>('macros-list', () => [])

  async function fetchMacros() {
    const { macros: rows } = await $fetch('/api/macros')
    macros.value = rows
  }

  async function addMacro(payload: NewMacro) {
    const { macro } = await $fetch('/api/macros', { method: 'POST', body: payload })
    macros.value.unshift(macro)
    return macro
  }

  async function updateMacro(id: string, payload: Partial<NewMacro>) {
    const { macro } = await $fetch(`/api/macros/${id}`, { method: 'PATCH', body: payload })
    const index = macros.value.findIndex(m => m.id === id)
    if (index !== -1)
      macros.value[index] = macro
    return macro
  }

  async function removeMacro(id: string) {
    await $fetch(`/api/macros/${id}`, { method: 'DELETE' })
    macros.value = macros.value.filter(m => m.id !== id)
  }

  return { macros, fetchMacros, addMacro, updateMacro, removeMacro }
}
