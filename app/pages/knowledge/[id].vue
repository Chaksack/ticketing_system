<script setup lang="ts">
import type { KbArticle, KbStatus, KbVisibility } from '~/types/knowledge'
import { toast } from 'vue-sonner'
import { KB_STATUSES, KB_VISIBILITY } from '~/types/knowledge'

definePageMeta({ middleware: 'agent' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const { currentUser, isAdmin } = useAuth()
const { staff, fetchStaff } = useStaff()
const { confirm } = useConfirm()

const article = ref<KbArticle | null>(null)
const similar = ref<KbArticle[]>([])
const notFound = ref(false)

const title = ref('')
const body = ref('')
const visibility = ref<KbVisibility>('internal')
const products = ref('')
const reviewerId = ref('')

function fill(next: KbArticle) {
  article.value = next
  title.value = next.title
  body.value = next.body
  visibility.value = next.visibility
  products.value = next.products.join(', ')
  reviewerId.value = next.reviewerId ?? ''
}

async function load() {
  try {
    const result = await fetchUntyped<{ article: KbArticle, similar: KbArticle[] }>(`/api/knowledge/${id.value}`)
    fill(result.article)
    similar.value = result.similar
  }
  catch (error: any) {
    if (error?.statusCode === 404)
      notFound.value = true
    else
      toast.error('Could not load the article', { description: error?.data?.statusMessage })
  }
}

onMounted(async () => {
  await load()
  await fetchStaff()
})

const reviewers = computed(() => staff.value.filter(s => s.status === 'active' && s.roles.some(r => ['admin', 'agent', 'engineer', 'engineering_coordinator', 'engineering_lead'].includes(r))))

const productList = computed(() => products.value.split(',').map(p => p.trim()).filter(Boolean))
const isDirty = computed(() => !!article.value && (
  title.value !== article.value.title
  || body.value !== article.value.body
  || visibility.value !== article.value.visibility
  || productList.value.join(',') !== article.value.products.join(',')
  || reviewerId.value !== (article.value.reviewerId ?? '')
))

const canPublish = computed(() => isAdmin.value || (!!reviewerId.value && reviewerId.value === currentUser.value?.id))
const canDelete = computed(() => !!article.value && (isAdmin.value || (article.value.authorId === currentUser.value?.id && article.value.status !== 'published')))

const SAVED_MESSAGE = {
  submit_review: 'Sent for review',
  publish: 'Article published',
  unpublish: 'Moved back to draft',
  archive: 'Article archived',
  restore: 'Restored as a draft',
} as const

const busy = ref(false)
async function save(action?: 'submit_review' | 'publish' | 'unpublish' | 'archive' | 'restore') {
  if (!article.value)
    return
  busy.value = true
  try {
    const result = await fetchUntyped<{ article: KbArticle }>(`/api/knowledge/${id.value}`, {
      method: 'PATCH',
      body: { title: title.value, body: body.value, visibility: visibility.value, products: productList.value, reviewerId: reviewerId.value || null, action },
    })
    fill(result.article)
    toast(action ? SAVED_MESSAGE[action] : 'Saved')
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    busy.value = false
  }
}

defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

async function remove() {
  if (!article.value || !(await confirm({ title: `Delete ${article.value.id}?`, description: 'This can\'t be undone.', confirmLabel: 'Delete', destructive: true })))
    return
  try {
    await $fetch(`/api/knowledge/${id.value}`, { method: 'DELETE' })
    toast('Article deleted')
    await navigateTo('/knowledge')
  }
  catch (error: any) {
    toast.error('Could not delete', { description: error?.data?.statusMessage })
  }
}

// ── Formatting toolbar: inserts Markdown around the selection ─────────────
const editor = ref<HTMLTextAreaElement>()
const tab = ref<'write' | 'preview'>('write')

function surround(before: string, after = before, placeholder = 'text') {
  const el = editor.value
  if (!el)
    return
  const start = el.selectionStart
  const end = el.selectionEnd
  const selected = body.value.slice(start, end) || placeholder
  body.value = `${body.value.slice(0, start)}${before}${selected}${after}${body.value.slice(end)}`
  nextTick(() => {
    el.focus()
    el.setSelectionRange(start + before.length, start + before.length + selected.length)
  })
}

/** Prefix every selected line (or insert a new block) — for headings and numbered steps. */
function prefixLines(make: (index: number) => string, placeholder: string) {
  const el = editor.value
  if (!el)
    return
  const start = body.value.lastIndexOf('\n', el.selectionStart - 1) + 1
  const end = el.selectionEnd
  const chunk = body.value.slice(start, end) || placeholder
  const replaced = chunk.split('\n').map((line, i) => `${make(i)}${line.replace(/^(#{1,3}\s+|\d+[.)]\s+|[-*]\s+)/, '')}`).join('\n')
  const needsGap = start > 0 && body.value[start - 2] !== '\n' ? '\n' : ''
  body.value = `${body.value.slice(0, start)}${needsGap}${replaced}${body.value.slice(end)}`
  nextTick(() => el.focus())
}

function insertBlock(block: string) {
  const el = editor.value
  const at = el?.selectionEnd ?? body.value.length
  const before = body.value.slice(0, at)
  const gap = before && !before.endsWith('\n\n') ? (before.endsWith('\n') ? '\n' : '\n\n') : ''
  body.value = `${before}${gap}${block}\n\n${body.value.slice(at)}`
  nextTick(() => el?.focus())
}

const fileInput = ref<HTMLInputElement>()
const uploading = ref(false)
async function uploadImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  uploading.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    form.append('folder', 'knowledge')
    const { url, name } = await fetchUntyped<{ url: string, name: string }>('/api/uploads/image', { method: 'POST', body: form })
    insertBlock(`![${name.replace(/\.[^.]+$/, '').replace(/[[\]]/g, '')}](${url})`)
  }
  catch (error: any) {
    toast.error('Image upload failed', { description: error?.data?.statusMessage })
  }
  finally {
    uploading.value = false
    if (fileInput.value)
      fileInput.value.value = ''
  }
}

const isVideoOpen = ref(false)
const videoUrl = ref('')
function addVideo() {
  if (!/^https?:\/\//.test(videoUrl.value.trim()))
    return
  insertBlock(`@[video](${videoUrl.value.trim()})`)
  videoUrl.value = ''
  isVideoOpen.value = false
}

const previewHtml = computed(() => renderMarkdown(body.value))
const statusLabel = (status: KbStatus) => KB_STATUSES.find(s => s.value === status)?.label ?? status

onBeforeRouteLeave(async () => {
  if (isDirty.value && !(await confirm({ title: 'Leave without saving?', description: 'Your unsaved changes to this article will be lost.', confirmLabel: 'Leave' })))
    return false
})
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <NuxtLink to="/knowledge" class="inline-flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground">
      <Icon name="i-lucide-arrow-left" class="size-4" /> Knowledge base
    </NuxtLink>

    <p v-if="notFound" class="text-muted-foreground">
      This article doesn't exist or was deleted.
    </p>

    <div v-else-if="article" class="flex flex-wrap items-start gap-4">
      <section class="flex min-w-0 flex-[999_1_640px] flex-col gap-4 rounded-[28px] bg-card p-5 ring-1 ring-black/10 sm:p-7 dark:ring-white/10">
        <div class="flex flex-wrap items-center justify-between gap-2.5">
          <span class="text-[13px] font-semibold text-muted-foreground">
            {{ article.id }} · {{ statusLabel(article.status) }} v{{ article.version }}
            <template v-if="article.sourceTicketId">
              · from <NuxtLink :to="`/tickets?open=${article.sourceTicketId}`" class="text-primary underline-offset-2 hover:underline dark:text-brand-lime">{{ article.sourceTicketId }}</NuxtLink>
            </template>
            <template v-if="isDirty"> · unsaved changes</template>
          </span>
          <div class="flex flex-wrap gap-2">
            <Button variant="outline" :disabled="busy || !isDirty" @click="save()">
              Save
            </Button>
            <template v-if="article.status === 'draft'">
              <Button v-if="canPublish" variant="lime" :disabled="busy" @click="save('publish')">
                Publish
              </Button>
              <Button v-else variant="lime" :disabled="busy || !reviewerId" :title="reviewerId ? undefined : 'Choose a reviewer first'" @click="save('submit_review')">
                Send for review
              </Button>
            </template>
            <template v-else-if="article.status === 'in_review'">
              <Button v-if="canPublish" variant="lime" :disabled="busy" @click="save('publish')">
                Approve &amp; publish
              </Button>
              <span v-else class="self-center text-sm text-muted-foreground">Waiting for {{ article.reviewerName ?? 'review' }}</span>
            </template>
            <template v-else-if="article.status === 'published'">
              <Button v-if="canPublish" variant="outline" :disabled="busy" @click="save('unpublish')">
                Unpublish
              </Button>
              <Button variant="ghost" :disabled="busy" @click="save('archive')">
                Archive
              </Button>
            </template>
            <Button v-else variant="outline" :disabled="busy" @click="save('restore')">
              Restore
            </Button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <div role="toolbar" aria-label="Formatting" class="flex flex-wrap gap-1 rounded-full bg-brand-fog p-1.5 dark:bg-muted">
            <Button variant="ghost" size="icon" aria-label="Bold" class="font-extrabold" :disabled="tab === 'preview'" @click="surround('**')">
              B
            </Button>
            <Button variant="ghost" size="icon" aria-label="Italic" class="italic" :disabled="tab === 'preview'" @click="surround('*')">
              I
            </Button>
            <Button variant="ghost" :disabled="tab === 'preview'" @click="prefixLines(() => '## ', 'Heading')">
              Heading
            </Button>
            <Button variant="ghost" :disabled="tab === 'preview'" @click="prefixLines(i => `${i + 1}. `, 'First step')">
              Steps
            </Button>
            <Button variant="ghost" :disabled="tab === 'preview'" @click="surround('[', '](https://)', 'link text')">
              Link
            </Button>
            <Button variant="ghost" :disabled="tab === 'preview' || uploading" @click="fileInput?.click()">
              {{ uploading ? 'Uploading…' : 'Image' }}
            </Button>
            <Button variant="ghost" :disabled="tab === 'preview'" @click="isVideoOpen = true">
              Video
            </Button>
          </div>
          <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="uploadImage">
          <PageSegmentedTabs v-model="tab" label="Editor mode" :options="[{ value: 'write', label: 'Write' }, { value: 'preview', label: 'Preview' }]" />
        </div>

        <label class="sr-only" for="kb-title">Title</label>
        <input
          id="kb-title"
          v-model="title"
          class="w-full bg-transparent text-3xl font-black leading-tight tracking-[-0.045em] text-foreground outline-none placeholder:text-muted-foreground sm:text-[40px]"
          placeholder="Title"
        >

        <template v-if="tab === 'write'">
          <label class="sr-only" for="kb-body">Article body</label>
          <textarea
            id="kb-body"
            ref="editor"
            v-model="body"
            rows="18"
            class="min-h-[360px] w-full resize-y rounded-2xl border border-input bg-background p-4 font-mono text-[15px] leading-relaxed outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            placeholder="**Symptom.** What the customer sees…&#10;&#10;**Fix.**&#10;1. First step"
          />
          <p class="m-0 text-xs text-muted-foreground">
            Markdown: **bold**, *italic*, ## heading, 1. steps, - bullets, [link](https://…). Press ⌘S to save.
          </p>
        </template>
        <!-- renderMarkdown escapes everything and only emits a fixed set of tags (app/lib/markdown.ts). -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div v-else class="kb-prose max-w-3xl" v-html="previewHtml" />
      </section>

      <aside class="flex flex-[1_1_300px] flex-col gap-3.5 sm:max-w-[380px]">
        <section class="flex flex-col gap-3 rounded-[28px] bg-card p-5 ring-1 ring-black/10 dark:ring-white/10">
          <h2 class="m-0 text-base font-bold text-foreground">
            Publishing
          </h2>
          <div class="flex flex-col gap-1.5">
            <Label for="kb-visibility">Visible to</Label>
            <Select v-model="visibility">
              <SelectTrigger id="kb-visibility" class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in KB_VISIBILITY" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="kb-products">Products or categories</Label>
            <Input id="kb-products" v-model="products" placeholder="Comma-separated, e.g. Barrier, Access control" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="kb-reviewer">Review by</Label>
            <Select v-model="reviewerId">
              <SelectTrigger id="kb-reviewer" class="w-full">
                <SelectValue placeholder="Choose a reviewer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="member in reviewers" :key="member.id" :value="member.id">
                  {{ member.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <dl class="m-0 grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
            <div class="rounded-xl bg-muted/60 p-2">
              <dd class="m-0 text-base font-bold text-foreground">
                {{ article.views }}
              </dd>
              <dt>views</dt>
            </div>
            <div class="rounded-xl bg-muted/60 p-2">
              <dd class="m-0 text-base font-bold text-foreground">
                {{ article.helpfulYes }}
              </dd>
              <dt>helpful</dt>
            </div>
            <div class="rounded-xl bg-muted/60 p-2">
              <dd class="m-0 text-base font-bold text-foreground">
                {{ article.helpfulNo }}
              </dd>
              <dt>not helpful</dt>
            </div>
          </dl>
          <Button v-if="canDelete" variant="ghost" class="self-start text-destructive hover:text-destructive" @click="remove">
            <Icon name="i-lucide-trash-2" />
            Delete article
          </Button>
        </section>

        <section class="rounded-[28px] bg-brand-mist p-5 text-sm leading-normal text-brand-forest dark:bg-brand-spruce dark:text-brand-mist">
          <b>Similar articles.</b>
          <template v-if="similar.length">
            Link to these rather than repeating them:
            <ul class="mb-0 mt-2 flex list-none flex-col gap-1.5 p-0">
              <li v-for="item in similar" :key="item.id">
                <NuxtLink :to="`/knowledge/${item.id}`" class="font-semibold underline underline-offset-2">
                  {{ item.title }}
                </NuxtLink> <span class="opacity-75">· {{ statusLabel(item.status) }}</span>
              </li>
            </ul>
          </template>
          <template v-else>
            None found — this looks like a new topic.
          </template>
        </section>
      </aside>
    </div>

    <p v-else class="text-sm text-muted-foreground">
      Loading…
    </p>

    <Dialog v-model:open="isVideoOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a video</DialogTitle>
          <DialogDescription>Paste a YouTube link to embed it, or any other video link to show it as a link.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-4" @submit.prevent="addVideo">
          <Input v-model="videoUrl" type="url" placeholder="https://www.youtube.com/watch?v=…" aria-label="Video link" autofocus />
          <DialogFooter>
            <Button type="submit" :disabled="!/^https?:\/\//.test(videoUrl.trim())">
              Add video
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
