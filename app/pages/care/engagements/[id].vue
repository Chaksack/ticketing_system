<script setup lang="ts">
import type { CareEngagement, CareStage } from '~/types/care'
import { toast } from 'vue-sonner'
import { CARE_CHANNELS, CARE_MODELS, CARE_PRODUCTIVE_HOURS_PER_AGENT, CARE_SHRINKAGE, CARE_STAGES } from '~/types/care'

// "Canopy Care — new client engagement" in the Canopy design.
definePageMeta({ middleware: 'platform' })

const route = useRoute()
const id = computed(() => String(route.params.id))
const engagement = ref<CareEngagement | null>(null)
const staff = ref<{ id: string, name: string }[]>([])
const saved = ref('')

onMounted(async () => {
  try {
    const result = await fetchUntyped<{ engagement: CareEngagement, staff: { id: string, name: string }[] }>(`/api/care/engagements/${id.value}`)
    engagement.value = result.engagement
    staff.value = result.staff
    saved.value = JSON.stringify(result.engagement)
  }
  catch {
    toast.error('Engagement not found')
    await navigateTo('/care')
  }
})
const isDirty = computed(() => !!engagement.value && JSON.stringify(engagement.value) !== saved.value)

const saving = ref(false)
async function save(stage?: CareStage) {
  if (!engagement.value)
    return
  saving.value = true
  try {
    const result = await fetchUntyped<{ engagement: CareEngagement }>(`/api/care/engagements/${id.value}`, { method: 'PATCH', body: { ...engagement.value, stage: stage ?? engagement.value.stage } })
    engagement.value = result.engagement
    saved.value = JSON.stringify(result.engagement)
    toast(stage ? `Moved to ${CARE_STAGES.find(s => s.value === stage)?.label ?? 'Ended'}` : 'Engagement saved')
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage })
  }
  finally {
    saving.value = false
  }
}
defineShortcuts({ meta_s: { usingInput: true, handler: () => isDirty.value && save() } })

function toggleChannel(channel: string) {
  if (!engagement.value)
    return
  const list = engagement.value.channels
  engagement.value.channels = list.includes(channel) ? list.filter(c => c !== channel) : [...list, channel]
}
function toggleAgent(staffId: string) {
  if (!engagement.value)
    return
  const list = engagement.value.agentIds
  engagement.value.agentIds = list.includes(staffId) ? list.filter(s => s !== staffId) : [...list, staffId]
}
const newReason = ref('')
function addReason() {
  if (engagement.value && newReason.value.trim()) {
    engagement.value.reasons.push({ label: newReason.value.trim(), inScope: true })
    newReason.value = ''
  }
}
const newRecommendation = ref('')
function addRecommendation() {
  if (engagement.value && newRecommendation.value.trim()) {
    engagement.value.recommendations.push({ id: Math.random().toString(36).slice(2, 10), text: newRecommendation.value.trim() })
    newRecommendation.value = ''
  }
}

// Staffing estimate (the design's planning assumptions; replace with pilot data).
const workloadHours = computed(() => engagement.value ? Math.round(engagement.value.monthlyContacts * engagement.value.ahtMinutes / 60) : 0)
const agentsNeeded = computed(() => Math.max(1, Math.ceil(workloadHours.value / (CARE_PRODUCTIVE_HOURS_PER_AGENT * (1 - CARE_SHRINKAGE)))))
const model = computed(() => CARE_MODELS.find(m => m.value === engagement.value?.model))
const scorecardTotal = computed(() => engagement.value?.scorecard.reduce((sum, r) => sum + Number(r.weight || 0), 0) ?? 0)
const stageIndex = computed(() => CARE_STAGES.findIndex(s => s.value === engagement.value?.stage))
const nextStage = computed(() => CARE_STAGES[stageIndex.value + 1])
</script>

<template>
  <div class="mx-auto flex w-full max-w-[1360px] flex-col gap-4">
    <CareNav />

    <template v-if="engagement">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="text-[13px] font-semibold text-muted-foreground">
            Canopy Care engagement · existing Canopy client{{ isDirty ? ' · unsaved changes' : '' }}
          </div>
          <h1 class="m-0 mt-1.5 text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
            {{ engagement.orgName }}
          </h1>
        </div>
        <div class="flex flex-wrap gap-2">
          <Button variant="outline" :disabled="saving || !isDirty" @click="save()">
            Save
          </Button>
          <Button v-if="engagement.stage === 'agreement'" variant="outline" as-child>
            <NuxtLink to="/console/onboarding">
              CSA &amp; SLA in Client onboarding
            </NuxtLink>
          </Button>
          <Button v-if="nextStage" variant="lime" :disabled="saving" @click="save(nextStage.value)">
            Continue to {{ nextStage.label.replace(/^\d · /, '') }}
          </Button>
          <Button v-else-if="engagement.stage === 'live'" variant="ghost" class="text-destructive" @click="save('ended')">
            End engagement
          </Button>
        </div>
      </div>

      <RecordStageBar :stages="CARE_STAGES" :current="engagement.stage === 'ended' ? 'live' : engagement.stage" label="Engagement stages" @select="(s) => save(s)" />

      <div class="flex flex-wrap items-start gap-4">
        <div class="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <RecordCard title="What we'll handle">
            <fieldset class="m-0 flex flex-wrap gap-2 border-0 p-0">
              <legend class="mb-2 text-[13px] font-semibold">
                Channels
              </legend>
              <label v-for="channel in CARE_CHANNELS" :key="channel" class="flex items-center gap-2 rounded-full bg-muted/60 px-3 py-1.5 text-sm">
                <Checkbox :model-value="engagement.channels.includes(channel)" @update:model-value="toggleChannel(channel)" /> {{ channel }}
              </label>
            </fieldset>
            <p class="m-0 text-xs text-muted-foreground">
              The agent desktop picks up web chats and email tickets today. Voice and WhatsApp need a telephony/messaging provider connected first.
            </p>
            <fieldset class="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend class="mb-2 text-[13px] font-semibold">
                Contact reasons
              </legend>
              <label v-for="(reason, index) in engagement.reasons" :key="index" class="flex items-center gap-2 text-sm">
                <Checkbox v-model="reason.inScope" /> {{ reason.label }} <span v-if="!reason.inScope" class="text-xs text-muted-foreground">(out of scope — warm transfer)</span>
              </label>
              <form class="flex gap-2" @submit.prevent="addReason">
                <Input v-model="newReason" placeholder="Add a contact reason" aria-label="New contact reason" />
                <Button type="submit" variant="outline" :disabled="!newReason.trim()">
                  Add
                </Button>
              </form>
            </fieldset>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label for="care-hours" class="text-[13px] font-semibold">Hours</Label>
                <Input id="care-hours" v-model="engagement.hours" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="care-languages" class="text-[13px] font-semibold">Languages</Label>
                <Input id="care-languages" v-model="engagement.languages" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="care-volume" class="text-[13px] font-semibold">Expected contacts / month</Label>
                <Input id="care-volume" v-model.number="engagement.monthlyContacts" type="number" min="0" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="care-aht" class="text-[13px] font-semibold">Avg. handle time (minutes)</Label>
                <Input id="care-aht" v-model.number="engagement.ahtMinutes" type="number" min="1" />
              </div>
            </div>
          </RecordCard>

          <RecordCard title="Commercial model">
            <div class="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Commercial model">
              <button
                v-for="option in CARE_MODELS"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="engagement.model === option.value"
                class="min-h-[72px] rounded-2xl px-4 py-3.5 text-left"
                :class="engagement.model === option.value ? 'bg-brand-forest text-white ring-2 ring-brand-forest' : 'bg-card text-brand-forest ring-1 ring-[#868685] dark:text-foreground'"
                @click="engagement.model = option.value"
              >
                <span class="block font-bold">{{ option.label }}</span>
                <span class="block text-sm opacity-80">{{ option.basis }}</span>
              </button>
            </div>
          </RecordCard>

          <RecordCard title="Playbook">
            <div class="flex flex-col gap-1.5">
              <Label for="care-greeting" class="text-[13px] font-semibold">Greeting</Label>
              <Input id="care-greeting" v-model="engagement.greeting" />
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-1.5">
                <Label for="care-sla" class="text-[13px] font-semibold">Service level (shown to agents)</Label>
                <Input id="care-sla" v-model="engagement.slaText" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="care-target" class="text-[13px] font-semibold">Chat first-reply target (seconds)</Label>
                <Input id="care-target" v-model.number="engagement.replyTargetSeconds" type="number" min="10" />
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="care-dos" class="text-[13px] font-semibold">Always</Label>
              <Textarea id="care-dos" v-model="engagement.dos" rows="2" placeholder="e.g. Confirm full name and date of birth before discussing appointments." />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="care-donts" class="text-[13px] font-semibold">Never</Label>
              <Textarea id="care-donts" v-model="engagement.donts" rows="2" placeholder="e.g. Give clinical advice — warm-transfer to a nurse." />
            </div>
          </RecordCard>

          <RecordCard title="Quality scorecard">
            <div v-for="(row, index) in engagement.scorecard" :key="index" class="flex items-center gap-2">
              <Input v-model="row.label" aria-label="Criterion" class="flex-1" />
              <Input v-model.number="row.weight" type="number" min="1" max="100" aria-label="Weight" class="w-24" />
              <Button variant="ghost" size="icon-sm" aria-label="Remove" @click="engagement.scorecard.splice(index, 1)">
                <Icon name="i-lucide-x" />
              </Button>
            </div>
            <div class="flex items-center justify-between text-sm">
              <Button variant="outline" size="sm" @click="engagement.scorecard.push({ label: '', weight: 10 })">
                + Criterion
              </Button>
              <span :class="scorecardTotal === 100 ? 'text-muted-foreground' : 'font-semibold text-amber-700 dark:text-amber-400'">Weights total {{ scorecardTotal }}{{ scorecardTotal === 100 ? '' : ' (scores are scaled to 100)' }}</span>
            </div>
          </RecordCard>
        </div>

        <aside class="flex flex-[1_1_300px] flex-col gap-4 sm:max-w-[400px]">
          <RecordCard title="Transition checklist">
            <label v-for="(item, index) in engagement.checklist" :key="index" class="flex items-start gap-2.5 text-sm">
              <Checkbox v-model="item.done" class="mt-0.5" /> {{ item.label }}
            </label>
            <p class="m-0 text-xs text-muted-foreground">
              Everything must be ticked before the engagement can go live.
            </p>
          </RecordCard>

          <RecordCard title="Staffing estimate" tone="forest">
            <div class="text-[44px] font-black leading-none tracking-[-0.04em] text-brand-lime">
              {{ engagement.model === 'dedicated' ? agentsNeeded : `≈ ${agentsNeeded}` }} agent{{ agentsNeeded === 1 ? '' : 's' }}
            </div>
            <div class="text-sm text-brand-mist">
              {{ model?.note }}
            </div>
            <dl class="m-0 grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt class="text-brand-mist">
                  Workload
                </dt><dd class="m-0 font-bold">
                  {{ workloadHours }} agent-hours / month
                </dd>
              </div>
              <div>
                <dt class="text-brand-mist">
                  Billing basis
                </dt><dd class="m-0 font-bold">
                  {{ model?.basis }}
                </dd>
              </div>
            </dl>
            <p class="m-0 text-xs text-brand-mist">
              Assumes {{ CARE_PRODUCTIVE_HOURS_PER_AGENT }} productive hours per agent per month and {{ CARE_SHRINKAGE * 100 }}% shrinkage. Replace with pilot data.
            </p>
          </RecordCard>

          <RecordCard title="Care agents">
            <p class="m-0 text-xs text-muted-foreground">
              Canopy staff who answer for {{ engagement.orgName }} in the agent desktop. Add Care agents in
              <NuxtLink to="/hq/team" class="font-semibold underline">
                Team &amp; access
              </NuxtLink>.
            </p>
            <label v-for="member in staff" :key="member.id" class="flex items-center gap-2 text-sm">
              <Checkbox :model-value="engagement.agentIds.includes(member.id)" @update:model-value="toggleAgent(member.id)" /> {{ member.name }}
            </label>
          </RecordCard>

          <RecordCard title="Recommendations for the client" tone="mist">
            <p class="m-0 text-xs">
              They appear on the client's results page for them to approve.
            </p>
            <div v-for="(item, index) in engagement.recommendations" :key="item.id" class="flex items-start gap-2 text-sm">
              <span class="flex-1">{{ item.text }}<span v-if="item.approvedAt" class="block text-xs font-semibold">Approved by {{ item.approvedBy }}</span></span>
              <Button variant="ghost" size="icon-sm" aria-label="Remove" @click="engagement.recommendations.splice(index, 1)">
                <Icon name="i-lucide-x" />
              </Button>
            </div>
            <form class="flex gap-2" @submit.prevent="addRecommendation">
              <Input v-model="newRecommendation" class="bg-card" placeholder="e.g. Add a self-service reschedule link to reminder SMS" aria-label="New recommendation" />
              <Button type="submit" variant="outline" :disabled="!newRecommendation.trim()">
                Add
              </Button>
            </form>
          </RecordCard>

          <p class="m-0 rounded-2xl bg-brand-fog p-4 text-sm text-brand-forest dark:bg-muted dark:text-foreground">
            <b>Data stays with the client.</b> Care agents work inside {{ engagement.orgName }}'s own Canopy workspace, and every reply is labelled "· Canopy Care".
          </p>
        </aside>
      </div>
    </template>
    <p v-else class="text-sm text-muted-foreground">
      Loading…
    </p>
  </div>
</template>
