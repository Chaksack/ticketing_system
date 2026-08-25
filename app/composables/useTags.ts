import type { TicketTag } from '~/types/ticket'

export function useTags() {
  const tags = useState<TicketTag[]>('tags-list', () => [])

  async function fetchTags() {
    const { tags: rows } = await $fetch('/api/tags')
    tags.value = rows
  }

  async function createTag(name: string, color?: string) {
    const { tag } = await $fetch('/api/tags', { method: 'POST', body: { name, color } })
    if (!tags.value.some(t => t.id === tag.id))
      tags.value.push(tag)
    return tag
  }

  async function removeTag(id: string) {
    await $fetch(`/api/tags/${id}`, { method: 'DELETE' })
    tags.value = tags.value.filter(t => t.id !== id)
  }

  return { tags, fetchTags, createTag, removeTag }
}
