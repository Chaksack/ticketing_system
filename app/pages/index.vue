<script setup lang="ts">
import type { DemoSector } from '~/types/organization'
import { DEMO_SECTORS } from '~/types/organization'

// Public landing page. Signed-in staff go straight to their own start page instead.
definePageMeta({
  layout: 'blank',
  middleware: 'landing',
})

useSeoMeta({
  title: 'Canopy: every customer, every team, one canopy',
  description: 'Canopy brings support, sales, projects and reporting together on one record.',
})

const year = new Date().getFullYear()
const NuxtLink = resolveComponent('NuxtLink')

const NAV_LINKS = [
  { href: '#apps', label: 'Apps' },
  { href: '#sectors', label: 'Sectors' },
  { href: '#platform', label: 'Platform' },
  { href: '#pricing', label: 'Pricing' },
] as const

const MODULES = [
  { title: 'Support desk', tone: 'forest', copy: 'Tickets from the portal, email and staff, with SLA timers, automatic assignment, escalation and on-call paging.' },
  { title: 'Sales pipeline', tone: 'mist', copy: 'Leads, tenders and clients with win probability, quotes and orders, and duplicate detection built in.' },
  { title: 'Projects & delivery', tone: 'fog', copy: 'Projects, AMC contracts, tasks and sprints, plus each project\'s value, costs, payments and amount due.' },
  { title: 'Calendar & chat', tone: 'fog', copy: 'Meetings and site visits linked to the deal or client they\'re for, direct messages and project channels.' },
  { title: 'Reports', tone: 'mist', copy: 'BD & SM, support and executive dashboards, rep scorecards and quota progress, exportable to PDF.' },
  { title: 'Ask AI & integrations', tone: 'lime', copy: 'An assistant that answers from live data, plus Slack, Gmail, ERP sync and an open API.' },
] as const

const TONE_CLASS: Record<(typeof MODULES)[number]['tone'], { card: string, title: string, copy: string }> = {
  forest: { card: 'bg-brand-forest', title: 'text-brand-lime', copy: 'text-white' },
  mist: { card: 'bg-brand-mist', title: 'text-brand-forest', copy: 'text-[#454745]' },
  fog: { card: 'bg-brand-fog', title: 'text-brand-forest', copy: 'text-[#454745]' },
  lime: { card: 'bg-brand-lime', title: 'text-brand-forest', copy: 'text-brand-forest' },
}

// Sector tabs — each one describes what the existing apps already do for that kind of business.
const SECTORS: { name: DemoSector, copy: string, items: string[] }[] = [
  {
    name: 'Real estate',
    copy: 'Take maintenance requests from tenants through your portal, track fit-out and facility projects, and keep service contracts renewing on time.',
    items: ['Tenant requests through the customer portal', 'SLA timers on every maintenance ticket', 'Fit-out projects with costs and payments', 'AMC contracts with renewal reminders'],
  },
  {
    name: 'Healthcare',
    copy: 'Keep equipment and IT support for clinics and labs on schedule, with every call, visit and contract on the client record.',
    items: ['Urgent tickets paged to on-call engineers', 'Site visits on the shared calendar', 'Service contracts per facility', 'Response and resolution reporting'],
  },
  {
    name: 'Financial services',
    copy: 'Win and serve institutional clients: track leads and tenders, send quotes, and answer branch requests against agreed SLAs.',
    items: ['Leads and tenders with win probability', 'Quotes and sales orders', 'Branch requests with priority-based SLAs', 'Role-based access for each team'],
  },
  {
    name: 'Manufacturing',
    copy: 'Connect quotes, orders and after-sales support so sales and service work from the same customer record.',
    items: ['Product catalogue and quotes', 'Sales orders linked to the client', 'After-sales tickets and on-site visits', 'ERP sync for clients and projects'],
  },
  {
    name: 'Public sector',
    copy: 'Respond to tenders, deliver the projects you win, and report on every service request.',
    items: ['Tender tracking with deadline reminders', 'Project tasks, sprints and timesheets', 'Escalation from engineer to lead', 'PDF reports for reviews'],
  },
  {
    name: 'Retail',
    copy: 'Handle store and head-office requests in one queue, and keep the contracts behind each site in view.',
    items: ['One queue for every store', 'Categories and auto-assignment rules', 'Email updates on every request', 'Service contracts per site'],
  },
  {
    name: 'Education',
    copy: 'Look after campuses and IT with one helpdesk, and run the projects that keep facilities up to date.',
    items: ['Self-service portal for staff and students', 'Macros for common answers', 'Projects with budgets and amounts due', 'Executive dashboard'],
  },
  {
    name: 'Nonprofit',
    copy: 'Track funders and partners, deliver programmes as projects, and report without spreadsheets.',
    items: ['Funders and partners pipeline', 'Programmes with costs and payments', 'Shared calendar and project chat', 'BD & SM and executive reports'],
  },
]

const demo = reactive({ email: '', sector: 'Real estate' as DemoSector, website: '', busy: false, sent: false, error: '' })

const activeSector = ref(0)
const sector = computed(() => SECTORS[activeSector.value]!)

function onSectorKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')
    return
  event.preventDefault()
  const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + SECTORS.length) % SECTORS.length
  activeSector.value = next
  nextTick(() => document.getElementById(`sector-tab-${next}`)?.focus())
}

/** "Book a demo for <sector>": preselect it in the form and jump there. */
function bookForSector(name: DemoSector) {
  demo.sector = name
  document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' })
  nextTick(() => document.getElementById('demo-email')?.focus({ preventScroll: true }))
}

// No list prices are published yet, so each plan leads with what it's for instead of a figure.
const PLANS = [
  { name: 'Essentials', headline: 'Start small', copy: 'One app — Service, Sales or Projects — with the customer portal and shared client records.', cta: { label: 'Choose Essentials', to: '/signup' }, featured: false },
  { name: 'Professional', headline: 'Every app', copy: 'Service, Sales, Projects and Insights, with automation rules, SLA policies and Ask AI.', cta: { label: 'Choose Professional', to: '/signup' }, featured: true },
  { name: 'Enterprise', headline: 'Let\'s talk', copy: 'Staff-led onboarding with a signed service agreement and SLA, ERP sync and a named support contact.', cta: { label: 'Contact sales', to: '#demo' }, featured: false },
] as const

async function submitDemo() {
  demo.error = ''
  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(demo.email.trim())) {
    demo.error = 'Enter a valid work email, like you@company.com'
    return
  }
  demo.busy = true
  try {
    await $fetch('/api/demo-request', { method: 'POST', body: { email: demo.email, sector: demo.sector, website: demo.website } })
    demo.sent = true
  }
  catch (error: any) {
    demo.error = error?.data?.statusMessage ?? 'Something went wrong. Please try again.'
  }
  finally {
    demo.busy = false
  }
}

const PLATFORM = [
  { title: 'SLA & escalation', copy: 'First-response and resolution targets per priority, with escalation from engineer to lead.' },
  { title: 'Automation', copy: 'Rules that set priority, tags and assignees the moment a ticket or lead arrives.' },
  { title: 'Role-based access', copy: 'Each person sees the areas their role needs: support, BD, delivery or admin.' },
  { title: 'Open API', copy: 'Export clients, projects, products and tenders to your ERP with scoped API keys.', link: { to: '/docs', label: 'API reference' } },
]
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-[#454745]">
    <a href="#main" class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-brand-lime focus:px-4 focus:py-2 focus:text-brand-forest">
      Skip to content
    </a>

    <!-- Nav -->
    <header class="border-b border-brand-fog">
      <nav aria-label="Main" class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <NuxtLink to="/" aria-label="Canopy home" class="flex items-center no-underline">
          <BrandLogo tone="light" :size="34" />
        </NuxtLink>
        <div class="hidden items-center gap-1 md:flex">
          <a v-for="link in NAV_LINKS" :key="link.href" :href="link.href" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">{{ link.label }}</a>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink to="/login" class="inline-flex min-h-11 items-center rounded-full border border-brand-forest px-5 font-medium text-brand-forest hover:bg-brand-mist">
            Sign in
          </NuxtLink>
          <a href="#demo" class="inline-flex min-h-11 items-center rounded-full bg-brand-lime px-5 font-semibold text-brand-forest hover:bg-brand-lime/85">
            Book a demo
          </a>
        </div>
      </nav>
    </header>

    <main id="main">
      <!-- Hero -->
      <section class="mx-auto flex max-w-6xl flex-col gap-7 px-6 pb-16 pt-16 md:pt-20">
        <span class="self-start rounded-full bg-brand-mist px-3.5 py-2 text-[13px] font-semibold text-brand-forest">
          Support · Sales · Projects · Reporting
        </span>
        <h1 class="m-0 max-w-4xl text-[clamp(3.25rem,9vw,7rem)] font-black leading-[0.88] tracking-[-0.05em] text-brand-obsidian">
          Every customer.<br>Every team.<br>One canopy.
        </h1>
        <p class="m-0 max-w-2xl text-lg leading-relaxed md:text-[22px] md:leading-[1.45]">
          Canopy brings your support desk, sales pipeline, projects and reporting together on one record,
          so every customer request is tracked from the first message to the final sign-off.
        </p>
        <div class="flex flex-wrap gap-3">
          <NuxtLink to="/signup" class="inline-flex min-h-12 items-center rounded-full bg-brand-lime px-7 text-lg font-semibold text-brand-forest hover:bg-brand-lime/85">
            Create your workspace
          </NuxtLink>
          <a href="#apps" class="inline-flex min-h-12 items-center rounded-full border border-brand-forest px-7 text-lg font-medium text-brand-forest hover:bg-brand-mist">
            Explore the product
          </a>
        </div>

        <!-- Product preview (illustrative) -->
        <div class="mt-6 rounded-[28px] bg-brand-forest p-4 sm:p-6 lg:p-10" role="img" aria-label="Preview of the support queue: open, in-progress and resolved tickets, with an Ask AI suggestion">
          <div class="overflow-hidden rounded-2xl bg-white shadow-[0_10px_32px_rgba(0,0,0,0.15)]">
            <div class="flex items-center gap-2.5 border-b border-brand-spruce bg-brand-forest px-4 py-3">
              <BrandLogo tone="dark" :size="20" :wordmark="false" />
              <span class="text-sm font-semibold text-white">Canopy Service</span>
              <span class="text-sm text-brand-mist">/ Ticket queue</span>
            </div>
            <div class="grid gap-3 bg-[#f6f7f5] p-4 sm:grid-cols-2 lg:grid-cols-4">
              <div class="flex flex-col gap-2.5">
                <div class="flex justify-between text-[13px] font-semibold text-brand-forest">
                  <span>Open</span><span>3</span>
                </div>
                <div class="rounded-xl bg-white p-3 ring-1 ring-black/10">
                  <div class="text-sm font-semibold text-brand-obsidian">
                    Access control panel offline
                  </div>
                  <div class="text-[13px] text-[#5d605d]">
                    High · First response due in 40 min
                  </div>
                </div>
                <div class="rounded-xl bg-white p-3 ring-1 ring-black/10">
                  <div class="text-sm font-semibold text-brand-obsidian">
                    CCTV camera 4 not recording
                  </div>
                  <div class="text-[13px] text-[#5d605d]">
                    Medium · Assigned to on-call
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-2.5">
                <div class="flex justify-between text-[13px] font-semibold text-brand-forest">
                  <span>In progress</span><span>2</span>
                </div>
                <div class="rounded-xl bg-brand-mist p-3 ring-1 ring-brand-forest">
                  <div class="text-sm font-semibold text-brand-obsidian">
                    BMS alarm on chiller 2
                  </div>
                  <div class="text-[13px] text-brand-spruce">
                    Urgent · Escalated to Engineering Lead
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-2.5">
                <div class="flex justify-between text-[13px] font-semibold text-brand-forest">
                  <span>Resolved</span><span>5</span>
                </div>
                <div class="rounded-xl bg-white p-3 ring-1 ring-black/10">
                  <div class="text-sm font-semibold text-brand-obsidian">
                    Fire panel annual check
                  </div>
                  <div class="text-[13px] text-[#5d605d]">
                    Low · Resolved within SLA
                  </div>
                </div>
              </div>
              <div class="flex flex-col gap-2.5 rounded-xl bg-brand-forest p-4 text-white">
                <span class="self-start rounded-full bg-brand-lime px-2.5 py-1 text-xs font-semibold text-brand-forest">Ask AI</span>
                <p class="m-0 text-sm leading-normal">
                  Two tickets are close to their first-response deadline. Want a summary for the on-call engineer?
                </p>
                <span class="self-start rounded-full border border-brand-lime px-3.5 py-2 text-[13px] font-semibold text-brand-lime">Summarise</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Apps -->
      <section id="apps" class="mx-auto flex max-w-6xl scroll-mt-6 flex-col gap-8 px-6 py-16">
        <h2 class="m-0 max-w-3xl text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-obsidian">
          Start with one app. Grow into the whole suite.
        </h2>
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="module in MODULES" :key="module.title" class="flex flex-col gap-2.5 rounded-[28px] p-7" :class="TONE_CLASS[module.tone].card">
            <h3 class="m-0 text-[28px] font-black tracking-[-0.04em]" :class="TONE_CLASS[module.tone].title">
              {{ module.title }}
            </h3>
            <p class="m-0 text-base leading-normal" :class="TONE_CLASS[module.tone].copy">
              {{ module.copy }}
            </p>
          </div>
        </div>
      </section>

      <!-- Sectors -->
      <section id="sectors" class="scroll-mt-6 bg-brand-forest px-6 py-20">
        <div class="mx-auto flex max-w-6xl flex-col gap-8">
          <h2 class="m-0 max-w-3xl text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-lime">
            Built for your sector on day one.
          </h2>
          <div role="tablist" aria-label="Sectors" class="flex flex-wrap gap-2">
            <button
              v-for="(item, index) in SECTORS"
              :id="`sector-tab-${index}`"
              :key="item.name"
              type="button"
              role="tab"
              :aria-selected="activeSector === index"
              aria-controls="sector-panel"
              :tabindex="activeSector === index ? 0 : -1"
              class="min-h-11 rounded-full border px-5 text-base font-semibold transition-colors"
              :class="activeSector === index ? 'border-brand-lime bg-brand-lime text-brand-forest' : 'border-brand-mist bg-transparent text-white hover:bg-white/10'"
              @click="activeSector = index"
              @keydown="onSectorKeydown($event, index)"
            >
              {{ item.name }}
            </button>
          </div>
          <div
            id="sector-panel"
            role="tabpanel"
            :aria-labelledby="`sector-tab-${activeSector}`"
            class="grid gap-6 rounded-[28px] bg-brand-spruce p-6 md:grid-cols-2 md:p-12"
          >
            <div class="flex flex-col gap-4">
              <h3 class="m-0 text-[44px] font-black leading-none tracking-[-0.04em] text-white">
                {{ sector.name }}
              </h3>
              <p class="m-0 text-lg leading-relaxed text-brand-mist md:text-xl">
                {{ sector.copy }}
              </p>
              <button type="button" class="inline-flex min-h-12 items-center self-start rounded-full bg-brand-lime px-6 font-semibold text-brand-forest hover:bg-brand-lime/85" @click="bookForSector(sector.name)">
                Book a {{ sector.name.toLowerCase() }} demo
              </button>
            </div>
            <div class="flex flex-col gap-2.5">
              <div class="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-lime">
                Included out of the box
              </div>
              <div v-for="feature in sector.items" :key="feature" class="flex items-center gap-3 rounded-xl bg-brand-forest px-4 py-3.5 text-base text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0 text-brand-lime" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
                <span>{{ feature }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Platform -->
      <section id="platform" class="mx-auto grid max-w-6xl scroll-mt-6 items-center gap-10 px-6 py-20 md:grid-cols-2">
        <div class="flex flex-col gap-5">
          <h2 class="m-0 text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-obsidian">
            One data platform underneath it all.
          </h2>
          <p class="m-0 text-lg leading-normal">
            Tickets, clients, projects and the calendar share the same data, so support sees the contract, sales sees the open ticket and nobody re-types a client's details.
          </p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2">
          <div v-for="item in PLATFORM" :key="item.title" class="rounded-xl p-5 ring-1 ring-black/10">
            <h3 class="m-0 text-lg font-bold text-brand-forest">
              {{ item.title }}
            </h3>
            <p class="m-0 mt-1.5 text-[15px] leading-normal">
              {{ item.copy }}
            </p>
            <NuxtLink v-if="item.link" :to="item.link.to" class="mt-2 inline-block text-[15px] font-semibold text-brand-forest underline underline-offset-2">
              {{ item.link.label }}
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Pricing -->
      <section id="pricing" class="scroll-mt-6 bg-brand-fog px-6 py-20">
        <div class="mx-auto flex max-w-6xl flex-col gap-8">
          <h2 class="m-0 text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-obsidian">
            Simple plans, per user.
          </h2>
          <div class="grid gap-4 md:grid-cols-3">
            <div v-for="plan in PLANS" :key="plan.name" class="flex flex-col gap-3.5 rounded-[28px] p-8" :class="plan.featured ? 'bg-brand-forest' : 'bg-white'">
              <div class="flex items-center justify-between gap-2">
                <h3 class="m-0 text-xl font-bold" :class="plan.featured ? 'text-brand-lime' : 'text-brand-forest'">
                  {{ plan.name }}
                </h3>
                <span v-if="plan.featured" class="rounded-full bg-brand-lime px-3 py-1.5 text-xs font-semibold text-brand-forest">Most teams</span>
              </div>
              <div class="text-[44px] font-black leading-none tracking-[-0.04em]" :class="plan.featured ? 'text-white' : 'text-brand-obsidian'">
                {{ plan.headline }}
              </div>
              <p class="m-0 flex-1 text-[15px] leading-normal" :class="plan.featured ? 'text-brand-mist' : ''">
                {{ plan.copy }}
              </p>
              <component
                :is="plan.cta.to.startsWith('#') ? 'a' : NuxtLink"
                v-bind="plan.cta.to.startsWith('#') ? { href: plan.cta.to } : { to: plan.cta.to }"
                class="inline-flex min-h-11 items-center self-start rounded-full px-6"
                :class="plan.featured ? 'bg-brand-lime font-semibold text-brand-forest hover:bg-brand-lime/85' : 'border border-brand-forest font-medium text-brand-forest hover:bg-brand-mist'"
              >
                {{ plan.cta.label }}
              </component>
            </div>
          </div>
        </div>
      </section>

      <!-- Book a demo -->
      <section id="demo" class="mx-auto max-w-6xl scroll-mt-6 px-6 py-20">
        <div class="grid items-center gap-8 rounded-[28px] bg-brand-lime p-8 md:grid-cols-2 md:p-16">
          <h2 class="m-0 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.9] tracking-[-0.05em] text-brand-forest">
            See Canopy with your own data.
          </h2>
          <div v-if="demo.sent" role="status" class="flex flex-col gap-3 rounded-2xl bg-brand-forest p-6 text-white">
            <span class="text-2xl font-black tracking-[-0.03em] text-brand-lime">Thanks, we've got it.</span>
            <p class="m-0 leading-relaxed text-brand-mist">
              Someone from our team will email {{ demo.email }} to find a time that suits you.
            </p>
          </div>
          <form v-else class="flex flex-col gap-3" novalidate @submit.prevent="submitDemo">
            <label class="flex flex-col gap-1.5 text-sm font-semibold text-brand-forest">
              Work email
              <input
                id="demo-email"
                v-model="demo.email"
                type="email"
                autocomplete="email"
                required
                placeholder="you@company.com"
                :aria-invalid="!!demo.error"
                aria-describedby="demo-error"
                class="min-h-12 rounded-xl border border-brand-forest bg-white px-4 text-base font-normal text-brand-obsidian outline-none focus-visible:ring-2 focus-visible:ring-brand-forest"
              >
            </label>
            <label class="flex flex-col gap-1.5 text-sm font-semibold text-brand-forest">
              Sector
              <select v-model="demo.sector" class="min-h-12 rounded-xl border border-brand-forest bg-white px-4 text-base font-normal text-brand-obsidian outline-none focus-visible:ring-2 focus-visible:ring-brand-forest">
                <option v-for="name in DEMO_SECTORS" :key="name" :value="name">{{ name }}</option>
              </select>
            </label>
            <!-- Honeypot: hidden from people and screen readers; bots fill it in. -->
            <input v-model="demo.website" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="absolute -left-[9999px] h-0 w-0 opacity-0">
            <p id="demo-error" class="m-0 min-h-5 text-sm font-semibold text-[#8a1c1c]" aria-live="polite">
              {{ demo.error }}
            </p>
            <button type="submit" :disabled="demo.busy" class="min-h-13 rounded-full bg-brand-forest px-7 text-[17px] font-semibold text-brand-lime hover:bg-brand-spruce disabled:opacity-70">
              {{ demo.busy ? 'Sending…' : 'Book my demo' }}
            </button>
          </form>
        </div>
        <p class="m-0 mt-6 text-center text-[15px]">
          Already a customer and need help?
          <NuxtLink to="/portal" class="font-semibold text-brand-forest underline underline-offset-2">
            Submit a support request
          </NuxtLink>
        </p>
      </section>
    </main>

    <footer class="bg-brand-forest px-6 py-14">
      <div class="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6">
        <div class="flex flex-col gap-3">
          <BrandLogo tone="dark" :size="34" />
          <div class="text-sm text-brand-mist">
            © {{ year }} Canopy. All rights reserved.
          </div>
        </div>
        <nav aria-label="Footer" class="flex flex-wrap gap-6 text-[15px]">
          <a v-for="link in NAV_LINKS" :key="link.href" :href="link.href" class="text-white hover:text-brand-lime">{{ link.label }}</a>
          <a href="#demo" class="text-white hover:text-brand-lime">Contact</a>
          <NuxtLink to="/portal" class="text-white hover:text-brand-lime">
            Support
          </NuxtLink>
          <NuxtLink to="/docs" class="text-white hover:text-brand-lime">
            API reference
          </NuxtLink>
        </nav>
      </div>
    </footer>
  </div>
</template>
