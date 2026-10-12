<script setup lang="ts">
import type { Segment, SegmentCondition, SegmentField, SegmentPreview } from '~/types/marketing'
import { useDebounceFn } from '@vueuse/core'
import { toast } from 'vue-sonner'
import { stages as clientStages } from '~/components/clients/data'
import { leadStages } from '~/components/leads/data'
import { CONTACT_KINDS, SEGMENT_FIELDS } from '~/types/marketing'

// Segment builder ("Marketing — segment builder" in the Canopy design).
definePageMeta({ middleware: 'bd' })

const route = useRoute()
const isNew = computed(() => route.params.id === 'new')
const { staff, fetchStaff } = useStaff()
const { confirm } = useConfirm()

const segmentId = ref<string | null>(null)
const name = ref('New segment')
const description = ref('')
const conditions = ref<SegmentCondition[]>([])
const preview = ref<SegmentPreview | null>(null)
const saved = ref('')

const newId = () => Math.random().toString(36).slice(2, 10)

const refreshPreview = useDebounceFn(async () => {
  preview.value = (await fetchUntyped<{ preview: SegmentPreview }>('/api/marketing/segments/preview', { method: 'POST', body: { conditions: conditions.value } })).preview
}, 400)

onMounted(async () => {
  if (!isNew.value) {
    try {
      const result = await fetchUntyped<{ segment: Segment, preview: SegmentPreview }>(`/api/marketing/segments/${route.params.id}`)
      segmentId.value = result.segment.id
      name.value = result.segment.name
      description.value = result.segment.description ?? ''
      conditions.value = result.segment.conditions
      preview.value = result.preview
      saved.value = JSON.stringify([name.value, description.value, conditions.value])
    }
    catch {
      toast.error('Segment not found')
      await navigateTo('/marketing/segments')
    }
  }
  else {
    conditions.value = [{ id: newId(), field: 'kind', values: ['lead'], exclude: false }]
    refreshPreview()
  }
  await fetchStaff()
})

const isDirty = computed(() => JSON.stringify([name.value, description.value, conditions.value]) !== saved.value)

watch(conditions, refreshPreview, { deep: true })

const fieldDef = (field: SegmentField) => SEGMENT_FIELDS.find(f => f.value === field)!
function options(field: SegmentField): { value: string, label: string }[] {
  switch (field) {
    case 'kind': return CONTACT_KINDS
    case 'lead_stage': return leadStages.map(s => ({ value: s.value, label: s.label }))
    case 'client_stage': return clientStages.map(s => ({ value: s.value, label: s.label }))
    case 'assigned_to': return staff.value.filter(s => s.status === 'active').map(s => ({ value: s.id, label: s.name }))
    default: return []
  }
}
const groups = ['Record', 'Pipeline', 'Behaviour'] as const

function setField(condition: SegmentCondition, field: SegmentField) {
  condition.field = field
  const def = fieldDef(field)
  condition.values = def.input === 'boolean' ? ['true'] : def.input === 'number' ? ['30'] : []
}
function toggleValue(condition: SegmentCondition, value: string) {
  condition.values = condition.values.includes(value) ? condition.values.filter(v => v !== value) : [...condition.values, value]
}
function valueSummary(condition: SegmentCondition) {
  const labels = options(condition.field).filter(o => condition.values.includes(o.value)).map(o => o.label)
  return labels.length ? labels.join(', ') : 'Choose…'
}
function addCondition(exclude = false) {
  conditions.value.push({ id: newId(), field: exclude ? 'has_open_lead' : 'lead_stage', values: exclude ? ['true'] : [], exclude })
}

const saving = ref(false)
async function save(thenJourney = false) {
  saving.value = true
  try {
    const { segment } = await fetchUntyped<{ segment: Segment }>('/api/marketing/segments', { method: 'POST', body: { id: segmentId.value ?? undefined, name: name.value, description: description.value, conditions: conditions.value } })
    segmentId.value = segment.id
    saved.value = JSON.stringify([name.value, description.value, conditions.value])
    toast('Segment saved')
    if (thenJourney)
      await navigateTo({ path: '/marketing/journeys', query: { segment: segment.id } })
    else if (isNew.value)
      await navigateTo(`/marketing/segments/${segment.id}`, { replace: true })
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage })
  }
  finally {
    saving.value = false
  }
}

async function remove() {
  if (!segmentId.value || !(await confirm({ title: `Delete "${name.value}"?`, confirmLabel: 'Delete', destructive: true })))
    return
  try {
    await fetchUntyped(`/api/marketing/segments/${segmentId.value}`, { method: 'DELETE' })
    await navigateTo('/marketing/segments')
  }
  catch (error: any) {
    toast.error('Could not delete', { description: error?.data?.statusMessage })
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <MarketingNav />

    <div class="flex flex-wrap items-end justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="text-[13px] font-semibold text-muted-foreground">
          Segment · dynamic · members update as records change{{ isDirty ? ' · unsaved changes' : '' }}
        </div>
        <label for="segment-name" class="sr-only">Segment name</label>
        <input id="segment-name" v-model="name" class="mt-1.5 w-full bg-transparent text-4xl font-black leading-none tracking-[-0.045em] text-foreground outline-none sm:text-[44px]">
        <label for="segment-description" class="sr-only">Description</label>
        <input id="segment-description" v-model="description" placeholder="Add a description" class="mt-1 w-full bg-transparent text-muted-foreground outline-none">
      </div>
      <div class="flex flex-wrap gap-2">
        <Button v-if="segmentId" variant="ghost" class="text-destructive hover:text-destructive" @click="remove">
          Delete
        </Button>
        <Button variant="outline" :disabled="saving || (!isDirty && !!segmentId)" @click="save()">
          Save
        </Button>
        <Button variant="lime" :disabled="saving" @click="save(true)">
          Save &amp; use in journey
        </Button>
      </div>
    </div>

    <div class="flex flex-wrap items-start gap-4">
      <RecordCard title="Include contacts where…" class="flex-[999_1_600px]">
        <template v-for="(condition, index) in conditions" :key="condition.id">
          <div v-if="index > 0" class="pl-2 text-[13px] font-bold" :class="condition.exclude ? 'text-destructive' : 'text-primary dark:text-brand-lime'">
            {{ condition.exclude ? 'AND NOT' : 'AND' }}
          </div>
          <div class="flex flex-wrap items-center gap-2 rounded-2xl p-3.5 text-sm" :class="condition.exclude ? 'bg-destructive/10 text-destructive' : 'bg-brand-fog dark:bg-muted'">
            <Select :model-value="condition.field" @update:model-value="(v) => setField(condition, v as SegmentField)">
              <SelectTrigger class="h-9 w-auto rounded-xl bg-card font-semibold text-primary dark:text-foreground" aria-label="Field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup v-for="group in groups" :key="group">
                  <SelectLabel>{{ group }}</SelectLabel>
                  <SelectItem v-for="field in SEGMENT_FIELDS.filter(f => f.group === group)" :key="field.value" :value="field.value">
                    {{ group }} › {{ field.label }}
                  </SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
            <span>{{ fieldDef(condition.field).operatorLabel }}</span>

            <Popover v-if="fieldDef(condition.field).input === 'multi'">
              <PopoverTrigger as-child>
                <Button variant="outline" class="h-9 rounded-xl bg-card font-semibold">
                  {{ valueSummary(condition) }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="flex w-64 flex-col gap-1 p-2" align="start">
                <label v-for="option in options(condition.field)" :key="option.value" class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted">
                  <Checkbox :model-value="condition.values.includes(option.value)" @update:model-value="toggleValue(condition, option.value)" />
                  {{ option.label }}
                </label>
              </PopoverContent>
            </Popover>
            <Input v-else-if="fieldDef(condition.field).input === 'number'" v-model="condition.values[0]" type="number" min="0" class="h-9 w-28 rounded-xl bg-card" aria-label="Value" />
            <Select v-else-if="fieldDef(condition.field).input === 'boolean'" v-model="condition.values[0]">
              <SelectTrigger class="h-9 w-auto rounded-xl bg-card font-semibold" aria-label="Value">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">
                  true
                </SelectItem>
                <SelectItem value="false">
                  false
                </SelectItem>
              </SelectContent>
            </Select>
            <Input v-else v-model="condition.values[0]" class="h-9 w-44 rounded-xl bg-card" placeholder="e.g. Website" aria-label="Value" />

            <span class="ml-auto flex items-center gap-1">
              <Button variant="ghost" size="sm" :aria-pressed="condition.exclude" @click="condition.exclude = !condition.exclude">
                {{ condition.exclude ? 'Include instead' : 'Exclude' }}
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Remove condition" @click="conditions = conditions.filter(c => c.id !== condition.id)">
                <Icon name="i-lucide-x" />
              </Button>
            </span>
          </div>
        </template>
        <p v-if="!conditions.length" class="m-0 text-sm text-muted-foreground">
          No conditions: every contact with an email address is included.
        </p>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" @click="addCondition()">
            + Add condition
          </Button>
          <Button variant="ghost" @click="addCondition(true)">
            + Exclude contacts where…
          </Button>
        </div>
      </RecordCard>

      <aside class="flex flex-[1_1_300px] flex-col gap-3.5 sm:max-w-[380px]">
        <RecordCard tone="forest">
          <div class="text-sm text-brand-mist">
            Estimated members
          </div>
          <div class="text-[56px] font-black leading-none tracking-[-0.05em] text-brand-lime">
            {{ preview?.total ?? '—' }}
          </div>
          <div class="text-sm">
            <template v-if="preview">
              {{ preview.total - preview.unsubscribed }} can receive email<template v-if="preview.unsubscribed">
                · {{ preview.unsubscribed }} unsubscribed
              </template>
            </template>
          </div>
        </RecordCard>
        <RecordCard title="Sample members">
          <div v-for="member in preview?.sample ?? []" :key="member.key" class="text-sm">
            {{ member.name }}<template v-if="member.company && member.company !== member.name">
              · {{ member.company }}
            </template>
            <div class="text-xs text-muted-foreground">
              {{ member.email }}
            </div>
          </div>
          <p v-if="preview && !preview.total" class="m-0 text-sm text-muted-foreground">
            Nobody matches yet.
          </p>
        </RecordCard>
      </aside>
    </div>
  </div>
</template>
