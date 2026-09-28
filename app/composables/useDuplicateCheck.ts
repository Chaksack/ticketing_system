import { useDebounceFn } from '@vueuse/core'

export type DuplicateCheckEntity = 'leads' | 'tenders' | 'clients'

export interface DuplicateMatch {
  id: string
  label: string
  stage: string
  entity: DuplicateCheckEntity
  reason: 'name' | 'email' | 'phone'
}

export function useDuplicateCheck(entity: DuplicateCheckEntity, options: { excludeId?: () => string | undefined } = {}) {
  const matches = ref<DuplicateMatch[]>([])

  // Same kind + same name is refused by the server (409) for clients and leads — mirror that here
  // so the form says so before submitting. Everything else (email/phone, lead↔client) is a warning.
  const blockingMatch = computed(() => entity === 'tenders'
    ? undefined
    : matches.value.find(match => match.entity === entity && match.reason === 'name'))

  const check = useDebounceFn(async (params: { name?: string, email?: string, phone?: string }) => {
    if (!params.name?.trim() && !params.email?.trim() && !params.phone?.trim()) {
      matches.value = []
      return
    }

    const { matches: rows } = await $fetch<{ matches: DuplicateMatch[] }>(`/api/${entity}/check-duplicate`, {
      query: {
        name: params.name || undefined,
        email: params.email || undefined,
        phone: params.phone || undefined,
        excludeId: options.excludeId?.() || undefined,
      },
    })
    matches.value = rows
  }, 400)

  function reset() {
    matches.value = []
  }

  return { matches, blockingMatch, check, reset }
}
