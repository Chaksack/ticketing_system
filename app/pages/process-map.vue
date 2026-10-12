<script setup lang="ts">
import type { OrgApp } from '~/types/organization'

// "End-to-end process map" in the Canopy design: how work flows through Canopy, each step linked
// to the screen where it happens.
const { hasApp, isPlatformStaff } = useAuth()

interface Step { title: string, copy: string, to?: string, app?: OrgApp, platform?: boolean, external?: string }
const LANES: { title: string, subtitle: string, steps: Step[] }[] = [
  {
    title: 'Lead to cash',
    subtitle: 'Marketing → Sales → Delivery',
    steps: [
      { title: 'Attract', copy: 'Journeys and segments capture interest', to: '/marketing/journeys', app: 'marketing' },
      { title: 'Lead', copy: 'Captured, de-duplicated and auto-assigned', to: '/leads', app: 'sales' },
      { title: 'Qualify', copy: 'Stages, next steps and win probability', to: '/leads', app: 'sales' },
      { title: 'Opportunity', copy: 'Pipeline, tenders and forecast', to: '/overview', app: 'sales' },
      { title: 'Quote', copy: 'Quotes from the product catalogue', to: '/leads', app: 'sales' },
      { title: 'Client', copy: 'Converted lead becomes a client', to: '/clients', app: 'sales' },
      { title: 'Project', copy: 'Value, costs, payments and amount due', to: '/projects', app: 'projects' },
      { title: 'Invoice & payment', copy: 'In your ERP — synced to Canopy hourly', to: '/admin/erp-connections', external: 'ERP' },
    ],
  },
  {
    title: 'Case to resolution',
    subtitle: 'Service → Field Service',
    steps: [
      { title: 'Request', copy: 'Portal, email or live chat', to: '/portal' },
      { title: 'Case', copy: 'Created with priority and SLA', to: '/tickets', app: 'service' },
      { title: 'Route', copy: 'Automation rules and on-call paging', to: '/admin/automations', app: 'service' },
      { title: 'Diagnose', copy: 'Agent workspace, knowledge and Assist', to: '/knowledge', app: 'service' },
      { title: 'Work order', copy: 'Scheduled if a visit is needed', to: '/field', app: 'field' },
      { title: 'On site', copy: 'Technician checklist, photos, signature', to: '/field/work-orders', app: 'field' },
      { title: 'Resolve', copy: 'Resolution logged, SLA closed', to: '/tickets', app: 'service' },
      { title: 'Survey', copy: 'Customer rates the service', to: '/reports', app: 'service' },
    ],
  },
  {
    title: 'Join, run & renew',
    subtitle: 'Canopy and its clients',
    steps: [
      { title: 'Agreement', copy: 'CSA & SLA signed with Canopy', to: '/console/onboarding', platform: true },
      { title: 'Sign up', copy: 'An admin creates the organisation', to: '/signup' },
      { title: 'Set up', copy: 'Apps, team and data', to: '/admin/organization' },
      { title: 'Go live', copy: 'Teams work in Canopy daily', to: '/overview' },
      { title: 'Supported', copy: 'Staff console tracks SLA & health', to: '/console', platform: true },
      { title: 'Renew', copy: 'AMC renewals open a new deal', to: '/amc-plans', app: 'projects' },
    ],
  },
]

function available(step: Step) {
  if (step.platform && !isPlatformStaff.value)
    return false
  return !step.app || hasApp(step.app)
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <PageTitle title="How work flows through Canopy" description="Click any step to open its screen. Every step writes to the same customer record." />

    <section v-for="(lane, laneIndex) in LANES" :key="lane.title" class="flex flex-col gap-3 rounded-[28px] p-5 sm:p-6" :class="laneIndex === 1 ? 'bg-brand-forest' : 'bg-card ring-1 ring-black/10 dark:ring-white/10'">
      <div>
        <h2 class="m-0 text-xl font-black tracking-[-0.03em]" :class="laneIndex === 1 ? 'text-brand-lime' : 'text-foreground'">
          {{ lane.title }}
        </h2>
        <div class="text-sm" :class="laneIndex === 1 ? 'text-brand-mist' : 'text-muted-foreground'">
          {{ lane.subtitle }}
        </div>
      </div>
      <ol class="m-0 flex list-none flex-wrap items-stretch gap-2 p-0">
        <li v-for="(step, index) in lane.steps" :key="step.title" class="flex items-center gap-2">
          <component
            :is="available(step) ? resolveComponent('NuxtLink') : 'span'"
            :to="available(step) ? step.to : undefined"
            class="flex w-[150px] flex-col gap-1 rounded-2xl p-3.5 transition-colors"
            :class="[
              !available(step) ? 'cursor-not-allowed opacity-50' : '',
              step.external ? 'border-2 border-dashed border-brand-forest bg-transparent dark:border-brand-lime' : laneIndex === 1 ? 'bg-brand-spruce text-white hover:bg-brand-lime hover:text-brand-forest' : 'bg-brand-mist text-brand-forest hover:bg-brand-lime dark:bg-muted dark:text-foreground',
            ]"
            :title="available(step) ? undefined : 'Not switched on for your organisation'"
          >
            <span class="text-[11px] font-bold uppercase tracking-[0.08em] opacity-70">{{ String(index + 1).padStart(2, '0') }}{{ step.external ? ` · ${step.external}` : '' }}</span>
            <span class="font-bold" :class="laneIndex === 1 && step.external ? 'text-brand-lime' : ''">{{ step.title }}</span>
            <span class="text-xs leading-snug opacity-85" :class="laneIndex === 1 && step.external ? 'text-brand-mist' : ''">{{ step.copy }}</span>
          </component>
          <Icon v-if="index < lane.steps.length - 1" name="i-lucide-chevron-right" class="size-4 shrink-0" :class="laneIndex === 1 ? 'text-brand-lime' : 'text-muted-foreground'" aria-hidden="true" />
        </li>
      </ol>
    </section>

    <p class="m-0 rounded-2xl bg-brand-mist p-4 text-sm text-brand-forest dark:bg-brand-spruce dark:text-brand-mist">
      A renewal starts a new deal in the lead-to-cash flow, so the loop closes on the same client.
    </p>
  </div>
</template>
