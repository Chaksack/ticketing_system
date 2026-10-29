<script setup lang="ts">
import type { TagWithUsage } from '~/types/supportDesk'
import { toast } from 'vue-sonner'
import { TAG_COLORS, tagChipClass } from '~/lib/tagColors'

// Support setup → Tags: one set of tags for cases and live chats — create, rename, recolour, remove.
definePageMeta({ middleware: 'agent' })

const { isAdmin } = useAuth()
const { confirm } = useConfirm()
const tags = ref<TagWithUsage[] | null>(null)
async function load() {
  tags.value = (await fetchUntyped<{ tags: TagWithUsage[] }>('/api/service/tags')).tags
}
onMounted(load)

const search = ref('')
const shown = computed(() => (tags.value ?? []).filter(t => t.name.toLowerCase().includes(search.value.trim().toLowerCase())))

const newTag = reactive({ name: '', color: 'green' })
async function create() {
  if (!newTag.name.trim())
    return
  try {
    await fetchUntyped('/api/tags', { method: 'POST', body: newTag })
    toast(`Tag "${newTag.name.trim()}" added`)
    newTag.name = ''
    await load()
  }
  catch (error: any) {
    toast.error('Not added', { description: error?.data?.statusMessage })
  }
}

const editing = ref<string | null>(null)
const draft = reactive({ name: '', color: 'gray' })
function edit(tag: TagWithUsage) {
  editing.value = tag.id
  Object.assign(draft, { name: tag.name, color: tag.color })
}
async function saveEdit(tag: TagWithUsage) {
  try {
    await fetchUntyped(`/api/tags/${tag.id}`, { method: 'PATCH', body: draft })
    editing.value = null
    await load()
  }
  catch (error: any) {
    toast.error('Not saved', { description: error?.data?.statusMessage })
  }
}
async function remove(tag: TagWithUsage) {
  const used = tag.tickets + tag.chats
  if (!await confirm({ title: `Delete "${tag.name}"?`, description: used ? `It comes off ${tag.tickets} case${tag.tickets === 1 ? '' : 's'} and ${tag.chats} chat${tag.chats === 1 ? '' : 's'}.` : 'It isn\'t used anywhere yet.', confirmLabel: 'Delete', destructive: true }))
    return
  try {
    await fetchUntyped(`/api/tags/${tag.id}`, { method: 'DELETE' })
    await load()
  }
  catch (error: any) {
    toast.error('Not deleted', { description: error?.data?.statusMessage })
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageTitle title="Tags" description="Label cases and live chats by topic, product or customer type, then filter and report on them. Tags are shared by cases and chats." />

    <form class="flex flex-wrap items-end gap-2 rounded-[28px] bg-card p-4 ring-1 ring-black/10 dark:ring-white/10" @submit.prevent="create">
      <div class="flex min-w-[220px] flex-1 flex-col gap-1.5">
        <Label for="new-tag">New tag</Label>
        <Input id="new-tag" v-model="newTag.name" placeholder="e.g. Billing, Gate motors, VIP" maxlength="40" />
      </div>
      <div class="flex flex-col gap-1.5">
        <span class="text-sm font-medium">Colour</span>
        <div class="flex gap-1.5" role="radiogroup" aria-label="Colour">
          <button v-for="(color, key) in TAG_COLORS" :key="key" type="button" role="radio" :aria-checked="newTag.color === key" :aria-label="color.label" class="size-8 rounded-full ring-offset-2 ring-offset-card" :class="[color.dot, newTag.color === key ? 'ring-2 ring-brand-forest dark:ring-brand-lime' : '']" @click="newTag.color = key" />
        </div>
      </div>
      <Button type="submit" variant="lime" :disabled="!newTag.name.trim()">
        <Icon name="i-lucide-plus" />
        Add tag
      </Button>
    </form>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="search" placeholder="Find a tag…" class="pl-9" aria-label="Find a tag" />
    </div>

    <div class="overflow-x-auto rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Tag</TableHead>
            <TableHead class="text-right">
              Cases
            </TableHead>
            <TableHead class="text-right">
              Chats
            </TableHead>
            <TableHead class="w-0">
              <span class="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="tags && !shown.length">
            <TableCell :colspan="4" class="h-20 text-center text-muted-foreground">
              {{ search ? 'No tag matches.' : 'No tags yet.' }}
            </TableCell>
          </TableRow>
          <TableRow v-for="tag in shown" :key="tag.id">
            <TableCell>
              <form v-if="editing === tag.id" class="flex flex-wrap items-center gap-2" @submit.prevent="saveEdit(tag)">
                <Input v-model="draft.name" class="max-w-xs" maxlength="40" :aria-label="`New name for ${tag.name}`" />
                <div class="flex gap-1" role="radiogroup" aria-label="Colour">
                  <button v-for="(color, key) in TAG_COLORS" :key="key" type="button" role="radio" :aria-checked="draft.color === key" :aria-label="color.label" class="size-6 rounded-full ring-offset-2 ring-offset-card" :class="[color.dot, draft.color === key ? 'ring-2 ring-brand-forest dark:ring-brand-lime' : '']" @click="draft.color = key" />
                </div>
                <Button type="submit" size="sm">
                  Save
                </Button>
                <Button type="button" size="sm" variant="ghost" @click="editing = null">
                  Cancel
                </Button>
              </form>
              <span v-else class="rounded-full px-3 py-1 text-sm font-semibold" :class="tagChipClass(tag.color)">{{ tag.name }}</span>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              <NuxtLink v-if="tag.tickets" :to="`/tickets?tag=${tag.id}`" class="font-semibold hover:underline">
                {{ tag.tickets }}
              </NuxtLink>
              <span v-else class="text-muted-foreground">0</span>
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ tag.chats }}
            </TableCell>
            <TableCell>
              <div v-if="editing !== tag.id" class="flex gap-0.5">
                <Button variant="ghost" size="icon-sm" :aria-label="`Edit ${tag.name}`" @click="edit(tag)">
                  <Icon name="i-lucide-pencil" />
                </Button>
                <Button v-if="isAdmin" variant="ghost" size="icon-sm" class="text-destructive hover:text-destructive" :aria-label="`Delete ${tag.name}`" @click="remove(tag)">
                  <Icon name="i-lucide-trash-2" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
