import { useDebounceFn } from '@vueuse/core'

export interface DuplicateMatch {
  id: string
  label: string
  stage: string
}

type DuplicateCheckEntity = 'leads' | 'tenders' | 'clients'

export function useDuplicateCheck(entity: DuplicateCheckEntity) {
  const matches = ref<DuplicateMatch[]>([])

  const check = useDebounceFn(async (params: { name?: string, email?: string, phone?: string }) => {
    if (!params.name?.trim() && !params.email?.trim() && !params.phone?.trim()) {
      matches.value = []
      return
    }

    const { matches: rows } = await $fetch<{ matches: DuplicateMatch[] }>(`/api/${entity}/check-duplicate`, {
      query: { name: params.name || undefined, email: params.email || undefined, phone: params.phone || undefined },
    })
    matches.value = rows
  }, 400)

  function reset() {
    matches.value = []
  }

  return { matches, check, reset }
}
