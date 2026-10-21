<script setup lang="ts">
import type { KbArticle, KbStatus } from '~/types/knowledge'
import { toast } from 'vue-sonner'
import { KB_STATUSES } from '~/types/knowledge'

definePageMeta({ middleware: 'agent' })

const articles = ref<KbArticle[]>([])
const loading = ref(true)
const search = ref('')

async function load() {
  loading.value = true
  try {
    articles.value = (await fetchUntyped<{ articles: KbArticle[] }>('/api/knowledge')).articles
  }
  finally {
    loading.value = false
  }
}
onMounted(load)

type StatusFilter = 'all' | KbStatus
const statusFilter = ref<StatusFilter>('all')
const statusTabs = computed(() => [
  { value: 'all' as StatusFilter, label: 'All', count: articles.value.length },
  ...KB_STATUSES.map(s => ({ value: s.value as StatusFilter, label: s.label, count: articles.value.filter(a => a.status === s.value).length })),
])

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return articles.value.filter(a =>
    (statusFilter.value === 'all' || a.status === statusFilter.value)
    && (!q || a.title.toLowerCase().includes(q) || a.id.toLowerCase().includes(q) || a.products.some(p => p.toLowerCase().includes(q))),
  )
})

const STATUS_CLASS: Record<KbStatus, string> = {
  draft: 'bg-brand-fog text-brand-forest',
  in_review: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  published: 'bg-brand-forest text-brand-lime',
  archived: 'bg-muted text-muted-foreground',
}
const statusLabel = (status: KbStatus) => KB_STATUSES.find(s => s.value === status)?.label ?? status

function helpfulRate(article: KbArticle) {
  const votes = article.helpfulYes + article.helpfulNo
  return votes ? `${Math.round((article.helpfulYes / votes) * 100)}% of ${votes}` : '—'
}

const isNewOpen = ref(false)
const newTitle = ref('')
const creating = ref(false)
async function createArticle() {
  if (newTitle.value.trim().length < 3)
    return
  creating.value = true
  try {
    const { article } = await fetchUntyped<{ article: KbArticle }>('/api/knowledge', { method: 'POST', body: { title: newTitle.value } })
    isNewOpen.value = false
    newTitle.value = ''
    await navigateTo(`/knowledge/${article.id}`)
  }
  catch (error: any) {
    toast.error('Could not create the article', { description: error?.data?.statusMessage })
  }
  finally {
    creating.value = false
  }
}

function exportList() {
  downloadCsv('knowledge-articles.csv', ['ID', 'Title', 'Status', 'Visibility', 'Products', 'Author', 'Version', 'Views', 'Helpful', 'Not helpful', 'Updated'], visible.value.map(a => [
    a.id,
    a.title,
    statusLabel(a.status),
    a.visibility === 'public' ? 'Customers + staff' : 'Staff only',
    a.products.join('; '),
    a.authorName,
    a.version,
    a.views,
    a.helpfulYes,
    a.helpfulNo,
    a.updatedAt.slice(0, 10),
  ]))
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(APP_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' })
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <PageActions label="Knowledge actions">
      <Button variant="lime" @click="isNewOpen = true">
        <Icon name="i-lucide-plus" />
        New article
      </Button>
      <Button variant="ghost" :disabled="!visible.length" @click="exportList">
        <Icon name="i-lucide-download" />
        Export
      </Button>
    </PageActions>

    <PageTitle title="Knowledge base" description="Answers your team and your customers share. Public articles appear in the support portal as customers type.">
      <template #aside>
        <PageSegmentedTabs v-model="statusFilter" label="Status" :options="statusTabs" />
      </template>
    </PageTitle>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="search" placeholder="Search titles, IDs or products…" class="pl-9" aria-label="Search articles" />
    </div>

    <div class="rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Article</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Visible to</TableHead>
            <TableHead>Author</TableHead>
            <TableHead class="text-right">
              Views
            </TableHead>
            <TableHead>Helpful</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="article in visible" :key="article.id" class="cursor-pointer" @click="navigateTo(`/knowledge/${article.id}`)">
            <TableCell>
              <NuxtLink :to="`/knowledge/${article.id}`" class="font-semibold text-foreground hover:underline" @click.stop>
                {{ article.title }}
              </NuxtLink>
              <div class="text-xs text-muted-foreground">
                {{ article.id }}<template v-if="article.products.length">
                  · {{ article.products.join(', ') }}
                </template>
              </div>
            </TableCell>
            <TableCell>
              <span class="rounded-full px-2.5 py-1 text-xs font-semibold" :class="STATUS_CLASS[article.status]">{{ statusLabel(article.status) }}</span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ article.visibility === 'public' ? 'Customers + staff' : 'Staff only' }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ article.authorName ?? '—' }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ article.views }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ helpfulRate(article) }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(article.updatedAt) }}
            </TableCell>
          </TableRow>
          <TableRow v-if="!visible.length">
            <TableCell :colspan="7" class="h-24 text-center text-muted-foreground">
              {{ loading ? 'Loading…' : articles.length ? 'No articles match.' : 'No articles yet. Write one, or open a resolved ticket and choose "Draft article".' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="isNewOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New article</DialogTitle>
          <DialogDescription>Start with the problem as a customer would describe it. You can write the body next.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="createArticle">
          <div class="flex flex-col gap-1.5">
            <Label for="kb-new-title">Title</Label>
            <Input id="kb-new-title" v-model="newTitle" placeholder="e.g. Barrier raises by itself" autofocus />
          </div>
          <DialogFooter>
            <Button type="submit" :disabled="creating || newTitle.trim().length < 3">
              Create draft
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
