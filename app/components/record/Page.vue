<script setup lang="ts">
import type { Interaction, RegardingType } from '~/types/interaction'

/**
 * The one record-page layout shared by leads, tenders and clients, laid out like a Dynamics 365
 * form: command bar → header (key fields + business process stage bar) → tabs.
 *  - Summary: the main fields (#summary), the Timeline (log calls, emails, meetings, notes; plus
 *    the record's history) and a side column (#key-card, Assist, the contact).
 *  - Details: secondary fields (#details) and the record information Dynamics shows on every form.
 *  - Related ▾: Activities, Quotes and Documents for every record, plus `relatedTabs` (rendered from
 *    `#tab-<value>` slots); the one you pick opens as its own tab.
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
  /** "Record information" on the Details tab. */
  info: { owner: string, createdAt: string, updatedAt?: string }
  relatedTabs?: { value: string, label: string, count?: number, icon: string }[]
}>()
const emit = defineEmits<{ stage: [value: string], reopen: [] }>()

const tab = defineModel<string>('tab', { default: 'summary' })
const related = computed(() => [
  ...(props.relatedTabs ?? []),
  { value: 'activities', label: 'Activities', count: props.interactions.length, icon: 'i-lucide-activity' },
  { value: 'quotes', label: 'Quotes', icon: 'i-lucide-file-text' },
  { value: 'documents', label: 'Documents', count: props.documents.length, icon: 'i-lucide-paperclip' },
])

const when = (iso: string) => new Date(iso).toLocaleString(APP_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

    <RecordTabs v-model="tab" :related="related" />

    <!-- Summary -->
    <div v-if="tab === 'summary'" class="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_minmax(0,0.9fr)]">
      <RecordCard title="Summary">
        <slot name="summary" />
      </RecordCard>

      <RecordCard title="Timeline">
        <InteractionsSection :regarding-type="regardingType" :regarding-id="regardingId" :interactions="interactions" />
        <h3 class="m-0 mt-2 text-sm font-bold text-foreground">
          Record history
        </h3>
        <ol class="m-0 flex list-none flex-col p-0">
          <li v-for="item in timeline" :key="item.id" class="border-b border-border py-2.5 last:border-0">
            <div class="flex justify-between gap-3">
              <span class="text-sm font-semibold text-foreground">{{ item.label }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{ when(item.at) }}</span>
            </div>
            <div v-if="item.actor" class="text-[13px] text-muted-foreground">
              {{ item.actor }}
            </div>
          </li>
          <li v-if="!timeline.length" class="py-2.5 text-sm text-muted-foreground">
            Nothing yet.
          </li>
        </ol>
      </RecordCard>

      <aside class="flex flex-col gap-4 lg:col-span-2 2xl:col-span-1">
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
            No contact yet — add one in Summary.
          </p>
        </RecordCard>
      </aside>
    </div>

    <!-- Details -->
    <div v-if="tab === 'details'" class="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <RecordCard title="Details">
        <slot name="details" />
      </RecordCard>
      <RecordCard title="Record information">
        <dl class="m-0 grid gap-3 text-sm">
          <div>
            <dt class="text-xs text-muted-foreground">
              ID
            </dt><dd class="m-0 font-semibold text-foreground">
              {{ regardingId }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Owner
            </dt><dd class="m-0 font-semibold text-foreground">
              {{ info.owner }}
            </dd>
          </div>
          <div>
            <dt class="text-xs text-muted-foreground">
              Created on
            </dt><dd class="m-0 text-foreground">
              {{ when(info.createdAt) }}
            </dd>
          </div>
          <div v-if="info.updatedAt">
            <dt class="text-xs text-muted-foreground">
              Modified on
            </dt><dd class="m-0 text-foreground">
              {{ when(info.updatedAt) }}
            </dd>
          </div>
        </dl>
      </RecordCard>
    </div>

    <!-- Related -->
    <template v-for="extra in relatedTabs ?? []" :key="extra.value">
      <slot v-if="tab === extra.value" :name="`tab-${extra.value}`" />
    </template>

    <RecordCard v-if="tab === 'activities'" title="Activities">
      <InteractionsSection :regarding-type="regardingType" :regarding-id="regardingId" :interactions="interactions" />
    </RecordCard>

    <RecordCard v-if="tab === 'quotes'">
      <QuotesSection :regarding-type="regardingType" :regarding-id="regardingId" :record-name="recordName" :contact-name="contact.name" :contact-email="contact.email" :contact-phone="contact.phone" />
    </RecordCard>

    <RecordDocumentsCard v-if="tab === 'documents'" :documents="documents" :upload="upload" :remove="removeDocument" />

    <slot />
  </div>
</template>
