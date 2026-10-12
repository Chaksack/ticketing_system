<script setup lang="ts">
import type { KbArticle } from '~/types/knowledge'
import type { Ticket } from '~/types/ticket'
import { toast } from 'vue-sonner'

/** Published articles that look relevant to this ticket, ready to drop into the reply. */
const props = defineProps<{ ticket: Ticket }>()
const emit = defineEmits<{ insert: [text: string] }>()

const { currentOrg } = useAuth()
const articles = ref<KbArticle[]>([])
const drafting = ref(false)

watch(() => props.ticket.id, async () => {
  articles.value = []
  try {
    const q = `${props.ticket.subject} ${props.ticket.subject} ${props.ticket.description}`.slice(0, 600)
    articles.value = (await fetchUntyped<{ articles: KbArticle[] }>('/api/knowledge', { query: { q, published: '1' } })).articles.slice(0, 3)
  }
  catch {
    // Suggestions are a convenience; the ticket works without them.
  }
}, { immediate: true })

function publicLink(article: KbArticle) {
  const slug = currentOrg.value?.slug ?? 'canopy'
  return `${window.location.origin}/kb/${slug}/${article.id}`
}

function insertLink(article: KbArticle) {
  emit('insert', `This article should help: ${article.title}\n${publicLink(article)}`)
}

function insertAnswer(article: KbArticle) {
  emit('insert', markdownToText(article.body))
}

async function draftArticle() {
  drafting.value = true
  try {
    const { article, aiWritten, aiError } = await fetchUntyped<{ article: KbArticle, aiWritten: boolean, aiError?: string }>('/api/knowledge/from-ticket', { method: 'POST', body: { ticketId: props.ticket.id } })
    toast(aiWritten ? 'Draft written from this ticket' : 'Draft started from this ticket', {
      description: aiWritten ? 'Check it over before sending it for review.' : aiError ?? 'Connect an AI in Settings → Integrations to have the draft written for you.',
    })
    await navigateTo(`/knowledge/${article.id}`)
  }
  catch (error: any) {
    toast.error('Could not draft an article', { description: error?.data?.statusMessage })
  }
  finally {
    drafting.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-2xl bg-brand-mist/60 p-3 dark:bg-brand-spruce/40">
    <div class="flex items-center justify-between gap-2">
      <h4 class="m-0 text-sm font-semibold">
        Knowledge
      </h4>
      <Button type="button" size="sm" variant="ghost" :disabled="drafting" @click="draftArticle">
        <Icon name="i-lucide-file-pen-line" />
        {{ drafting ? 'Drafting…' : 'Draft article from this ticket' }}
      </Button>
    </div>
    <p v-if="!articles.length" class="m-0 text-xs text-muted-foreground">
      No published article matches this ticket yet.
    </p>
    <div v-for="article in articles" :key="article.id" class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-black/5">
      <NuxtLink :to="`/knowledge/${article.id}`" class="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
        {{ article.title }}
      </NuxtLink>
      <div class="flex gap-1">
        <Button v-if="article.visibility === 'public'" type="button" size="sm" variant="outline" @click="insertLink(article)">
          Insert link
        </Button>
        <Button type="button" size="sm" variant="outline" @click="insertAnswer(article)">
          Insert answer
        </Button>
      </div>
    </div>
  </div>
</template>
