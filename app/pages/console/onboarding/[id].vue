<script setup lang="ts">
import type { AgreementStatus, ClientOnboarding, OrgApp, SlaTier } from '~/types/organization'
import { toast } from 'vue-sonner'
import { downloadAgreementPdf } from '~/lib/agreementPdf'
import { AGREEMENT_TERMS, ONBOARDING_CHECKLIST, ORG_APPS, ORG_PLANS, ORG_SECTORS, SLA_TIER_DEFAULTS, SUPPORT_CHANNELS, SUPPORT_HOURS } from '~/types/organization'

definePageMeta({ middleware: 'platform' })

const route = useRoute()
const id = computed(() => route.params.id as string)
const { fetchOnboarding, updateOnboarding, provisionOnboarding } = useConsole()

const STEPS = ['Client details', 'Plan & apps', 'CSA & SLA terms', 'Signature', 'Provision & kickoff'] as const
const step = ref(0)

const saved = ref<ClientOnboarding | null>(null)
const draft = ref<ClientOnboarding | null>(null)
const saving = ref(false)
const provisioning = ref(false)
const inviteFallbackUrl = ref('')

const locked = computed(() => saved.value?.status === 'provisioned')
const dirty = computed(() => JSON.stringify(saved.value) !== JSON.stringify(draft.value))

async function load() {
  saved.value = await fetchOnboarding(id.value)
  draft.value = structuredClone(toRaw(saved.value))
}

onMounted(load)

async function save(options: { quiet?: boolean } = {}) {
  if (!draft.value)
    return
  saving.value = true
  try {
    const d = draft.value
    saved.value = await updateOnboarding(id.value, {
      clientName: d.clientName,
      slug: d.slug,
      sector: d.sector,
      country: d.country,
      usersEstimate: d.usersEstimate ? Number(d.usersEstimate) : undefined,
      contactName: d.contactName,
      contactEmail: d.contactEmail,
      plan: d.plan,
      apps: d.apps,
      csa: d.csa,
      sla: d.sla,
      agreement: d.agreement,
      checklist: d.checklist,
    })
    draft.value = structuredClone(toRaw(saved.value))
    if (!options.quiet)
      toast('Saved')
    return true
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
    return false
  }
  finally {
    saving.value = false
  }
}

async function saveAndContinue() {
  if (await save({ quiet: true }))
    step.value = Math.min(STEPS.length - 1, step.value + 1)
}

// Workspace address availability (same rules as self-serve sign-up).
const slugStatus = ref<{ available: boolean, reason?: string, slug: string } | null>(null)
let slugTimer: ReturnType<typeof setTimeout> | undefined
watch(() => draft.value?.slug, (value) => {
  slugStatus.value = null
  clearTimeout(slugTimer)
  if (!value?.trim() || locked.value)
    return
  slugTimer = setTimeout(async () => {
    slugStatus.value = await $fetch<{ available: boolean, reason?: string, slug: string }>('/api/signup/slug', { query: { value } })
  }, 350)
})

function toggleApp(app: OrgApp, on: boolean) {
  if (!draft.value)
    return
  draft.value.apps = on ? [...draft.value.apps, app] : draft.value.apps.filter(a => a !== app)
}

function toggleChannel(channel: string, on: boolean) {
  if (!draft.value)
    return
  draft.value.csa.channels = on ? [...draft.value.csa.channels, channel] : draft.value.csa.channels.filter(c => c !== channel)
}

function pickTier(tier: SlaTier) {
  if (!draft.value)
    return
  draft.value.sla = { ...structuredClone(SLA_TIER_DEFAULTS[tier]), serviceCredits: draft.value.sla.serviceCredits }
}

const AGREEMENT_STEPS: { key: keyof Omit<AgreementStatus, 'signedAt'>, label: string, hint: string }[] = [
  { key: 'draftCreated', label: 'Draft created', hint: 'The CSA & SLA above, as a PDF.' },
  { key: 'legalReview', label: 'Legal review', hint: 'Both legal teams have reviewed the terms.' },
  { key: 'clientSigned', label: 'Client signature', hint: 'The client\'s authorised signatory has signed.' },
  { key: 'canopyCountersigned', label: 'Canopy countersign', hint: 'Canopy has countersigned. Provisioning unlocks.' },
]

async function setAgreementStep(key: keyof Omit<AgreementStatus, 'signedAt'>, done: boolean) {
  if (!draft.value)
    return
  draft.value.agreement = { ...draft.value.agreement, [key]: done ? 'done' : 'pending' }
  await save({ quiet: true })
}

async function toggleChecklist(item: string, done: boolean) {
  if (!draft.value)
    return
  draft.value.checklist = { ...draft.value.checklist, [item]: done }
  await save({ quiet: true })
}

const canProvision = computed(() => saved.value?.status === 'signed' && !!saved.value.slug && !!saved.value.contactName && !!saved.value.contactEmail)

async function onProvision() {
  if (dirty.value && !(await save({ quiet: true })))
    return
  provisioning.value = true
  try {
    const result = await provisionOnboarding(id.value)
    saved.value = result.onboarding
    draft.value = structuredClone(toRaw(result.onboarding))
    inviteFallbackUrl.value = result.inviteUrl ?? ''
    toast('Workspace provisioned', {
      description: result.inviteSent ? `Invite sent to ${result.onboarding.contactEmail}.` : 'The invite email couldn\'t be sent. Copy the link below.',
    })
  }
  catch (error: any) {
    toast.error('Could not provision', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    provisioning.value = false
  }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(inviteFallbackUrl.value)
    toast('Invite link copied')
  }
  catch {
    toast.error('Could not copy. Select the link and copy it manually.')
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <NuxtLink to="/console/onboarding" class="self-start text-sm text-muted-foreground hover:underline">
      ← All onboardings
    </NuxtLink>

    <p v-if="!draft" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">
            {{ draft.id }}<template v-if="draft.sector">
              · {{ draft.sector }}
            </template><template v-if="draft.usersEstimate">
              · {{ draft.usersEstimate }} users
            </template> · {{ ORG_PLANS.find(p => p.id === draft!.plan)?.label }} plan · Owner {{ draft.ownerName ?? '—' }}
          </div>
          <h1 class="text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
            {{ draft.clientName }}
          </h1>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <ConsoleStatusBadge :status="saved!.status" />
          <Button variant="outline" @click="downloadAgreementPdf(draft)">
            <Icon name="i-lucide-file-down" class="size-4" />
            Agreement PDF
          </Button>
          <Button v-if="!locked" :disabled="!dirty || saving" @click="save()">
            {{ saving ? 'Saving…' : 'Save' }}
          </Button>
        </div>
      </div>

      <nav aria-label="Onboarding steps" class="flex flex-wrap gap-2">
        <button
          v-for="(label, index) in STEPS"
          :key="label"
          type="button"
          :aria-current="step === index ? 'step' : undefined"
          class="min-h-10 rounded-full px-4 text-sm font-semibold transition-colors"
          :class="step === index ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'"
          @click="step = index"
        >
          {{ index + 1 }} · {{ label }}
        </button>
      </nav>

      <!-- 1 · Client details -->
      <Card v-if="step === 0">
        <CardHeader>
          <CardTitle>Client details</CardTitle>
          <CardDescription>The workspace address can't be changed once the tenant is provisioned.</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-4 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <Label for="ob-name">Company name</Label>
            <Input id="ob-name" v-model="draft.clientName" :disabled="locked" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ob-slug">Workspace address</Label>
            <Input id="ob-slug" v-model="draft.slug" placeholder="yourcompany" :disabled="locked" aria-describedby="ob-slug-help" />
            <span id="ob-slug-help" class="text-xs" :class="slugStatus && !slugStatus.available ? 'text-destructive' : 'text-muted-foreground'">
              {{ slugStatus && !slugStatus.available ? slugStatus.reason : `Portal: /portal/${slugStatus?.slug || draft.slug || 'yourcompany'}` }}
            </span>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Sector</Label>
            <Select v-model="draft.sector" :disabled="locked">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Choose a sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="sector in ORG_SECTORS" :key="sector.name" :value="sector.name">
                  {{ sector.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <Label for="ob-country">Country</Label>
              <Input id="ob-country" v-model="draft.country" placeholder="Ghana" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="ob-users">Users (est.)</Label>
              <Input id="ob-users" v-model="draft.usersEstimate" type="number" min="1" />
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ob-contact">Client administrator</Label>
            <Input id="ob-contact" v-model="draft.contactName" placeholder="Full name" :disabled="locked" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="ob-email">Administrator email</Label>
            <Input id="ob-email" v-model="draft.contactEmail" type="email" placeholder="admin@client.com" :disabled="locked" />
            <span class="text-xs text-muted-foreground">They get the invite to set their password once the workspace is provisioned.</span>
          </div>
        </CardContent>
      </Card>

      <!-- 2 · Plan & apps -->
      <Card v-else-if="step === 1">
        <CardHeader>
          <CardTitle>Plan &amp; apps</CardTitle>
          <CardDescription>After provisioning, change these from the tenant's page.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-5">
          <div class="flex flex-wrap gap-2" role="radiogroup" aria-label="Plan">
            <button
              v-for="plan in ORG_PLANS"
              :key="plan.id"
              type="button"
              role="radio"
              :aria-checked="draft.plan === plan.id"
              :disabled="locked"
              class="min-h-10 rounded-full px-5 text-sm font-semibold"
              :class="draft.plan === plan.id ? 'bg-primary text-primary-foreground' : 'border bg-card'"
              @click="draft.plan = plan.id"
            >
              {{ plan.label }}
            </button>
          </div>
          <div class="grid gap-2 sm:grid-cols-2">
            <label v-for="app in ORG_APPS" :key="app.id" class="flex items-start gap-3 rounded-xl border p-3">
              <Switch :model-value="draft.apps.includes(app.id)" :disabled="locked" @update:model-value="(on) => toggleApp(app.id, !!on)" />
              <span>
                <span class="block text-sm font-semibold">{{ app.label }}</span>
                <span class="block text-xs text-muted-foreground">{{ app.description }}</span>
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      <!-- 3 · CSA & SLA -->
      <div v-else-if="step === 2" class="grid gap-4 @4xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Service Agreement (CSA)</CardTitle>
            <CardDescription>What support Canopy provides, how the client reaches us and who is accountable.</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-5">
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-1 text-sm font-medium">
                Support channels
              </legend>
              <label v-for="channel in SUPPORT_CHANNELS" :key="channel" class="flex items-center gap-2.5 text-sm">
                <Checkbox :model-value="draft.csa.channels.includes(channel)" @update:model-value="(on) => toggleChannel(channel, !!on)" />
                {{ channel }}
              </label>
            </fieldset>
            <div class="flex flex-col gap-1.5">
              <Label>Support hours</Label>
              <Select v-model="draft.csa.hours">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="hours in SUPPORT_HOURS" :key="hours" :value="hours">
                    {{ hours }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="ob-contacts">Authorised client contacts</Label>
              <Textarea id="ob-contacts" v-model="draft.csa.contacts" rows="2" placeholder="Names and emails of who may raise P1 incidents" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Agreement term</Label>
              <Select v-model="draft.csa.term">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="term in AGREEMENT_TERMS" :key="term" :value="term">
                    {{ term }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <fieldset class="flex flex-col gap-2">
              <legend class="mb-1 text-sm font-medium">
                Escalation path
              </legend>
              <div class="flex flex-wrap items-center gap-1.5">
                <template v-for="(_, index) in draft.csa.escalationPath" :key="index">
                  <Input v-model="draft.csa.escalationPath[index]" class="h-9 w-44" :aria-label="`Escalation level ${index + 1}`" />
                  <span v-if="index < draft.csa.escalationPath.length - 1" aria-hidden="true" class="text-muted-foreground">→</span>
                </template>
              </div>
            </fieldset>
            <label class="flex items-center gap-2.5 text-sm">
              <Checkbox :model-value="draft.csa.attachDpa" @update:model-value="(on) => draft!.csa.attachDpa = !!on" />
              Attach Data Processing Agreement and security schedule
            </label>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Service Level Agreement (SLA)</CardTitle>
            <CardDescription>Targets fill from the tier; edit any cell to negotiate.</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-5">
            <div class="flex gap-1 self-start rounded-full bg-muted p-1" role="radiogroup" aria-label="SLA tier">
              <button
                v-for="tier in (['standard', 'gold', 'platinum'] as const)"
                :key="tier"
                type="button"
                role="radio"
                :aria-checked="draft.sla.tier === tier"
                class="min-h-9 rounded-full px-4 text-sm capitalize"
                :class="draft.sla.tier === tier ? 'bg-primary font-bold text-primary-foreground' : 'font-medium text-muted-foreground'"
                @click="pickTier(tier)"
              >
                {{ tier }}
              </button>
            </div>
            <div class="grid gap-3 sm:grid-cols-3">
              <div class="flex flex-col gap-1.5">
                <Label for="sla-uptime">Monthly uptime</Label>
                <Input id="sla-uptime" v-model="draft.sla.uptime" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="sla-maint">Planned maintenance</Label>
                <Input id="sla-maint" v-model="draft.sla.maintenance" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label for="sla-rec">Recovery (RPO / RTO)</Label>
                <Input id="sla-rec" v-model="draft.sla.recovery" />
              </div>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full min-w-[520px] text-sm">
                <thead>
                  <tr class="text-left text-xs text-muted-foreground">
                    <th class="py-2 pr-2 font-semibold">
                      Priority
                    </th>
                    <th class="py-2 pr-2 font-semibold">
                      First response
                    </th>
                    <th class="py-2 font-semibold">
                      Resolution target
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in draft.sla.rows" :key="row.priority" class="border-t">
                    <td class="py-2 pr-2">
                      <div class="font-bold">
                        {{ row.priority }}
                      </div>
                      <div class="text-xs text-muted-foreground">
                        {{ row.definition }}
                      </div>
                    </td>
                    <td class="py-2 pr-2">
                      <Input v-model="row.firstResponse" class="h-8" :aria-label="`${row.priority} first response`" />
                    </td>
                    <td class="py-2">
                      <Input v-model="row.resolution" class="h-8" :aria-label="`${row.priority} resolution target`" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label for="sla-credits">Service credits</Label>
              <Textarea id="sla-credits" v-model="draft.sla.serviceCredits" rows="3" />
            </div>
          </CardContent>
        </Card>
      </div>

      <!-- 4 · Signature -->
      <Card v-else-if="step === 3">
        <CardHeader>
          <CardTitle>Agreement status</CardTitle>
          <CardDescription>
            Download the agreement PDF, send it for signature, and mark each step as it happens. Each mark is recorded in the audit log.
          </CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2.5">
          <div v-for="item in AGREEMENT_STEPS" :key="item.key" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <div class="text-sm font-semibold">
                {{ item.label }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ item.hint }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <Badge variant="outline" :class="draft.agreement[item.key] === 'done' ? 'bg-brand-mist text-brand-forest dark:bg-accent dark:text-accent-foreground' : ''">
                {{ draft.agreement[item.key] === 'done' ? 'Done' : 'Waiting' }}
              </Badge>
              <Button v-if="item.key !== 'draftCreated'" size="sm" :variant="draft.agreement[item.key] === 'done' ? 'ghost' : 'outline'" :disabled="saving || locked" @click="setAgreementStep(item.key, draft.agreement[item.key] !== 'done')">
                {{ draft.agreement[item.key] === 'done' ? 'Undo' : 'Mark done' }}
              </Button>
            </div>
          </div>
          <p v-if="draft.agreement.signedAt" class="text-sm text-muted-foreground">
            Fully signed {{ new Date(draft.agreement.signedAt).toLocaleString() }}.
          </p>
        </CardContent>
      </Card>

      <!-- 5 · Provision & kickoff -->
      <div v-else class="grid gap-4 @3xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provision workspace</CardTitle>
            <CardDescription>Creates the client's own database and invites their administrator.</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-3 text-sm">
            <template v-if="locked">
              <p>
                Provisioned as <NuxtLink :to="`/console/tenants/${saved!.orgId}`" class="font-semibold underline">
                  {{ saved!.orgId }}
                </NuxtLink>.
              </p>
              <div v-if="inviteFallbackUrl" class="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                <span class="text-xs">The invite email couldn't be sent. Give {{ saved!.contactName }} this link (valid 7 days):</span>
                <div class="flex items-center gap-2">
                  <code class="flex-1 truncate text-xs">{{ inviteFallbackUrl }}</code>
                  <Button size="sm" variant="outline" aria-label="Copy invite link" @click="copyInvite">
                    <Icon name="i-lucide-copy" class="size-3.5" />
                  </Button>
                </div>
              </div>
            </template>
            <template v-else>
              <ul class="flex flex-col gap-1.5 text-muted-foreground">
                <li>{{ saved!.status === 'signed' ? '✓' : '○' }} CSA &amp; SLA signed and countersigned</li>
                <li>{{ saved!.slug ? '✓' : '○' }} Workspace address set</li>
                <li>{{ saved!.contactName && saved!.contactEmail ? '✓' : '○' }} Client administrator set</li>
              </ul>
              <Button class="self-start" :disabled="!canProvision || provisioning" @click="onProvision">
                {{ provisioning ? 'Provisioning…' : 'Provision tenant' }}
              </Button>
              <p v-if="!canProvision" class="text-xs text-muted-foreground">
                Provisioning unlocks after signature, with an address and an administrator.
              </p>
            </template>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Onboarding checklist</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <label v-for="item in ONBOARDING_CHECKLIST" :key="item" class="flex items-center gap-2.5 text-sm">
              <Checkbox :model-value="!!draft.checklist[item]" :disabled="saving" @update:model-value="(on) => toggleChecklist(item, !!on)" />
              {{ item }}
            </label>
          </CardContent>
        </Card>
      </div>

      <div v-if="!locked && step < STEPS.length - 1 && step !== 3" class="flex justify-end">
        <Button :disabled="saving" @click="saveAndContinue">
          Save &amp; continue
        </Button>
      </div>
    </template>
  </div>
</template>
