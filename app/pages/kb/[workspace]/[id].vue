<script setup lang="ts">
import type { PublicKbArticle } from '~/types/knowledge'

// Public: a published help article, linked from ticket replies and the support portal.
definePageMeta({ layout: 'blank' })

const route = useRoute()
const workspaceSlug = computed(() => String(route.params.workspace))
const articleId = computed(() => String(route.params.id))

const { data, error } = await useFetch<{ article: PublicKbArticle, workspace: { name: string, slug: string, isHome: boolean } | null }>(
  () => `/api/public/articles/${articleId.value}`,
  { query: { workspace: workspaceSlug } },
)

useSeoMeta({ title: () => data.value ? `${data.value.article.title} · ${data.value.workspace?.name ?? 'Canopy'} help` : 'Help article' })

const portalPath = computed(() => data.value?.workspace && !data.value.workspace.isHome ? `/portal/${data.value.workspace.slug}` : '/portal')
const html = computed(() => data.value ? renderMarkdown(data.value.article.body) : '')
const voted = ref<'helpful' | 'not_helpful' | null>(null)

async function send(action: 'view' | 'helpful' | 'not_helpful') {
  try {
    await $fetch(`/api/public/articles/${articleId.value}`, { method: 'POST', query: { workspace: workspaceSlug.value }, body: { action } })
  }
  catch {
    // Counting is best-effort.
  }
}

onMounted(() => data.value && send('view'))

function vote(action: 'helpful' | 'not_helpful') {
  voted.value = action
  send(action)
}
</script>

<template>
  <div class="min-h-screen bg-[#f6f7f5] font-sans text-[#454745]">
    <header class="border-b border-brand-fog bg-white">
      <div class="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <NuxtLink :to="portalPath" class="flex items-center gap-2 no-underline">
          <span v-if="data?.workspace && !data.workspace.isHome" class="text-xl font-black tracking-[-0.04em] text-brand-forest">{{ data.workspace.name }}</span>
          <BrandLogo v-else tone="light" :size="28" />
          <span class="border-l border-brand-fog pl-2 text-sm font-semibold text-brand-forest">Help</span>
        </NuxtLink>
        <NuxtLink :to="portalPath" class="inline-flex min-h-10 items-center rounded-full border border-brand-forest px-4 text-sm font-medium text-brand-forest hover:bg-brand-mist">
          Contact support
        </NuxtLink>
      </div>
    </header>

    <main class="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div v-if="error" class="rounded-[28px] bg-white p-8 ring-1 ring-black/10">
        <h1 class="m-0 text-3xl font-black tracking-[-0.04em] text-brand-obsidian">
          Article not found
        </h1>
        <p class="mt-3">
          It may have been moved or unpublished. <NuxtLink :to="portalPath" class="font-semibold text-brand-forest underline">
            Ask our support team
          </NuxtLink> instead.
        </p>
      </div>
      <article v-else-if="data" class="rounded-[28px] bg-white p-6 ring-1 ring-black/10 sm:p-10">
        <h1 class="m-0 text-3xl font-black leading-tight tracking-[-0.045em] text-brand-obsidian sm:text-[40px]">
          {{ data.article.title }}
        </h1>
        <p class="mt-2 text-sm text-[#5d605d]">
          Updated {{ new Date(data.article.updatedAt).toLocaleDateString(APP_LOCALE, { day: 'numeric', month: 'long', year: 'numeric' }) }}
        </p>
        <!-- renderMarkdown escapes everything and only emits a fixed set of tags (app/lib/markdown.ts). -->
        <!-- eslint-disable-next-line vue/no-v-html -->
        <div class="kb-prose mt-6 [--color-foreground:#0e0f0c]" v-html="html" />

        <div class="mt-10 flex flex-wrap items-center gap-3 border-t border-brand-fog pt-6">
          <template v-if="!voted">
            <span class="font-semibold text-brand-forest">Did this answer your question?</span>
            <button type="button" class="min-h-10 rounded-full bg-brand-lime px-5 font-semibold text-brand-forest" @click="vote('helpful')">
              Yes
            </button>
            <button type="button" class="min-h-10 rounded-full border border-brand-forest px-5 font-medium text-brand-forest" @click="vote('not_helpful')">
              No
            </button>
          </template>
          <p v-else role="status" class="m-0">
            Thanks for letting us know.
            <NuxtLink v-if="voted === 'not_helpful'" :to="portalPath" class="font-semibold text-brand-forest underline">
              Raise a request and we'll help directly.
            </NuxtLink>
          </p>
        </div>
      </article>
    </main>
  </div>
</template>
