import type { Page } from '~/types/oncall'

export function useOnCall() {
  const pages = useState<Page[]>('oncall-pages', () => [])

  async function fetchPages() {
    const { pages: rows } = await $fetch('/api/oncall/pages')
    pages.value = rows
  }

  async function acknowledgePage(id: string) {
    await $fetch(`/api/oncall/pages/${id}/acknowledge`, { method: 'POST' })
    const page = pages.value.find(p => p.id === id)
    if (page)
      page.acknowledged = true
    useAlarm().stop()
  }

  return { pages, fetchPages, acknowledgePage }
}
