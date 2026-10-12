<script setup lang="ts">
import type { Interaction, RegardingType } from '~/types/interaction'

/**
 * The one record-page layout shared by leads, tenders and clients, so they look and behave the
 * same: pill action bar → header with key figures and the stage bar → tabs. "Summary" is always
 * Details | Timeline | (key card, Assist, contact); Interactions, Quotes and Files are always there;
 * each record adds its own extra tabs through `extraTabs` and `#tab-<value>` slots.
 */
const props = defineProps<{
  backTo: string
  backLabel: string
  actionsLabel: string
  eyebrow: string
  title: string
  subtitle?: string
  stats: { label: string, value: string }[]
  stages: readonly { value: string, label: string }[]
  stage: string
  stageNote?: string
  stageReadonly?: boolean
  /** Shown instead of the stage bar (e.g. "This lead was lost"). */
  closedLabel?: string
  regardingType: RegardingType
  regardingId: string
  recordName: string
  contact: { name?: string, title?: string, email?: string, phone?: string }
  interactions: Interaction[]
  documents: { id: string, name: string, url: string, size?: number }[]
  upload: (file: File) => Promise<unknown>
  removeDocument: (id: string) => Promise<unknown>
  timeline: { id: string, label: string, actor?: string, at: string }[]
  extraTabs?: { value: string, label: string, count?: number }[]
}>()
const emit = defineEmits<{ stage: [value: string], reopen: [] }>()

const tab = defineModel<string>('tab', { default: 'summary' })
const tabs = computed(() => [
  { value: 'summary', label: 'Summary' },
  ...(props.extraTabs ?? []),
  { value: 'interactions', label: 'Interactions', count: props.interactions.length },
  { value: 'quotes', label: 'Quotes' },
  { value: 'files', label: 'Files', count: props.documents.length },
])

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
const initials = computed(() => (props.contact.name ?? props.contact.email ?? '?').split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase())
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
    <PageActions :label="actionsLabel">
      <Button variant="ghost" size="icon" as-child :aria-label="backLabel">
        <NuxtLink :to="backTo">
          <Icon name="i-lucide-arrow-left" />
        </NuxtLink>
      </Button>
      <slot name="actions" />
    </PageActions>

    <RecordHeader :eyebrow="eyebrow" :title="title" :subtitle="subtitle" :stats="stats">
      <p v-if="closedLabel" class="m-0 flex flex-wrap items-center gap-3 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
        {{ closedLabel }}
        <Button size="sm" variant="outline" @click="emit('reopen')">
          Reopen
        </Button>
      </p>
      <RecordStageBar v-else :stages="stages" :current="stage" label="Process" :note="stageNote" :readonly="stageReadonly" @select="(value) => emit('stage', value)" />
    </RecordHeader>

    <PageSegmentedTabs v-model="tab" label="Record sections" :options="tabs" class="self-start" />

    <!-- Summary: identical arrangement on every record -->
    <div v-if="tab === 'summary'" class="flex flex-wrap items-start gap-4">
      <RecordCard title="Details" class="flex-[1_1_340px]">
        <slot name="details" />
      </RecordCard>

      <RecordCard title="Timeline" class="flex-[1_1_340px]">
        <ol class="m-0 flex list-none flex-col p-0">
          <li v-for="item in timeline" :key="item.id" class="border-b border-border py-3 last:border-0">
            <div class="flex justify-between gap-3">
              <b class="text-sm text-foreground">{{ item.label }}</b>
              <span class="shrink-0 text-xs text-muted-foreground">{{ when(item.at) }}</span>
            </div>
            <div v-if="item.actor" class="text-[13px] text-muted-foreground">
              {{ item.actor }}
            </div>
          </li>
          <li v-if="!timeline.length" class="py-3 text-sm text-muted-foreground">
            Nothing yet.
          </li>
        </ol>
      </RecordCard>

      <aside class="flex flex-[1_1_300px] flex-col gap-4">
        <slot name="key-card" />
        <InsightsAiSuggestionCard :regarding-type="regardingType" :regarding-id="regardingId" />
        <RecordCard title="Contact">
          <div v-if="contact.name || contact.email" class="flex items-center gap-3">
            <span aria-hidden="true" class="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-mist text-sm font-bold text-brand-forest">{{ initials }}</span>
            <div class="min-w-0 text-sm">
              <div class="font-semibold text-foreground">
                {{ contact.name ?? contact.email }}<template v-if="contact.title">
                  · {{ contact.title }}
                </template>
              </div>
              <a v-if="contact.email" :href="`mailto:${contact.email}`" class="block truncate text-muted-foreground hover:underline">{{ contact.email }}</a>
              <a v-if="contact.phone" :href="`tel:${contact.phone.replace(/[^\d+]/g, '')}`" class="block text-muted-foreground hover:underline">{{ contact.phone }}</a>
            </div>
          </div>
          <p v-else class="m-0 text-sm text-muted-foreground">
            No contact yet — add one under Details.
          </p>
        </RecordCard>
      </aside>
    </div>

    <template v-for="extra in extraTabs ?? []" :key="extra.value">
      <slot v-if="tab === extra.value" :name="`tab-${extra.value}`" />
    </template>

    <RecordCard v-if="tab === 'interactions'">
      <InteractionsSection :regarding-type="regardingType" :regarding-id="regardingId" :interactions="interactions" />
    </RecordCard>

    <RecordCard v-if="tab === 'quotes'">
      <QuotesSection :regarding-type="regardingType" :regarding-id="regardingId" :record-name="recordName" :contact-name="contact.name" :contact-email="contact.email" :contact-phone="contact.phone" />
    </RecordCard>

    <RecordDocumentsCard v-if="tab === 'files'" :documents="documents" :upload="upload" :remove="removeDocument" />

    <slot />
  </div>
</template>
