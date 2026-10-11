<script setup lang="ts">
// Public landing page. Signed-in staff go straight to their own start page instead.
definePageMeta({
  layout: 'blank',
  middleware: [
    async () => {
      const { ensureAuth, isLoggedIn, homePath } = useAuth()
      await ensureAuth()
      if (isLoggedIn.value)
        return navigateTo(homePath.value)
    },
  ],
})

useSeoMeta({
  title: 'Canopy: every customer, every team, one canopy',
  description: 'Canopy brings support, sales, projects and reporting together on one record.',
})

const year = new Date().getFullYear()

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

const AUDIENCES = [
  {
    name: 'Clients',
    copy: 'Report a fault or ask for help in a couple of minutes, without an account. You get a reference number straight away and updates by email.',
    items: ['Submit a request from any device', 'Attach photos and documents', 'A reference number for every request', 'Email updates until it\'s resolved'],
  },
  {
    name: 'Support engineers',
    copy: 'Every request lands in one queue, already prioritised and assigned, with the clock visible on each one so nothing slips past its SLA.',
    items: ['Auto-assignment and escalation', 'Replies and internal notes on one thread', 'Macros for common answers', 'On-call paging for urgent tickets'],
  },
  {
    name: 'Sales & BD',
    copy: 'Track every lead and tender from first contact to signed project, with the calendar, emails and calls that moved it forward.',
    items: ['Leads, tenders and clients pipeline', 'Quotes, orders and AMC plans', 'Duplicate checks on names, emails and phones', 'Quotas, monthly or yearly'],
  },
  {
    name: 'Managers',
    copy: 'See how support, sales and delivery are doing without chasing anyone for a spreadsheet.',
    items: ['BD & SM report with calendar activity', 'Rep scorecards and quota progress', 'Project payments and amounts due', 'Executive dashboard and PDF exports'],
  },
]

const activeAudience = ref(0)
const audience = computed(() => AUDIENCES[activeAudience.value]!)

function onAudienceKeydown(event: KeyboardEvent, index: number) {
  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')
    return
  event.preventDefault()
  const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + AUDIENCES.length) % AUDIENCES.length
  activeAudience.value = next
  nextTick(() => document.getElementById(`audience-tab-${next}`)?.focus())
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
          <a href="#features" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">Features</a>
          <a href="#teams" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">For each team</a>
          <a href="#platform" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">Platform</a>
        </div>
        <div class="flex items-center gap-2">
          <NuxtLink to="/login" class="inline-flex min-h-11 items-center rounded-full border border-brand-forest px-5 font-medium text-brand-forest hover:bg-brand-mist">
            Sign in
          </NuxtLink>
          <NuxtLink to="/signup" class="inline-flex min-h-11 items-center rounded-full bg-brand-lime px-5 font-semibold text-brand-forest hover:bg-brand-lime/85">
            Create your workspace
          </NuxtLink>
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
          <NuxtLink to="/login" class="inline-flex min-h-12 items-center rounded-full border border-brand-forest px-7 text-lg font-medium text-brand-forest hover:bg-brand-mist">
            Sign in
          </NuxtLink>
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

      <!-- Features -->
      <section id="features" class="mx-auto flex max-w-6xl scroll-mt-6 flex-col gap-8 px-6 py-16">
        <h2 class="m-0 max-w-3xl text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-obsidian">
          Everything the team needs, in one place.
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

      <!-- For each team -->
      <section id="teams" class="scroll-mt-6 bg-brand-forest px-6 py-20">
        <div class="mx-auto flex max-w-6xl flex-col gap-8">
          <h2 class="m-0 max-w-3xl text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-lime">
            Built around how each team works.
          </h2>
          <div role="tablist" aria-label="Teams" class="flex flex-wrap gap-2">
            <button
              v-for="(item, index) in AUDIENCES"
              :id="`audience-tab-${index}`"
              :key="item.name"
              type="button"
              role="tab"
              :aria-selected="activeAudience === index"
              aria-controls="audience-panel"
              :tabindex="activeAudience === index ? 0 : -1"
              class="min-h-11 rounded-full border px-5 text-base font-semibold transition-colors"
              :class="activeAudience === index ? 'border-brand-lime bg-brand-lime text-brand-forest' : 'border-brand-mist bg-transparent text-white hover:bg-white/10'"
              @click="activeAudience = index"
              @keydown="onAudienceKeydown($event, index)"
            >
              {{ item.name }}
            </button>
          </div>
          <div
            id="audience-panel"
            role="tabpanel"
            :aria-labelledby="`audience-tab-${activeAudience}`"
            class="grid gap-6 rounded-[28px] bg-brand-spruce p-6 md:grid-cols-2 md:p-12"
          >
            <div class="flex flex-col gap-4">
              <h3 class="m-0 text-[40px] font-black leading-none tracking-[-0.04em] text-white">
                {{ audience.name }}
              </h3>
              <p class="m-0 text-lg leading-relaxed text-brand-mist md:text-xl">
                {{ audience.copy }}
              </p>
            </div>
            <div class="flex flex-col gap-2.5">
              <div class="text-[13px] font-bold uppercase tracking-[0.08em] text-brand-lime">
                Included
              </div>
              <div v-for="feature in audience.items" :key="feature" class="flex items-center gap-3 rounded-xl bg-brand-forest px-4 py-3.5 text-base text-white">
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
            One record underneath it all.
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

      <!-- Client support CTA -->
      <section id="support" class="mx-auto max-w-6xl scroll-mt-6 px-6 pb-20">
        <div class="grid items-center gap-8 rounded-[28px] bg-brand-lime p-8 md:grid-cols-2 md:p-16">
          <h2 class="m-0 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.9] tracking-[-0.05em] text-brand-forest">
            Need a hand? Raise a request.
          </h2>
          <div class="flex flex-col items-start gap-5">
            <p class="m-0 text-lg leading-relaxed text-brand-forest">
              Tell us what's happening and attach a photo if you can. You'll get a reference number right away, and our support team will follow up by email.
            </p>
            <NuxtLink to="/portal" class="inline-flex min-h-12 items-center rounded-full bg-brand-forest px-7 text-lg font-semibold text-brand-lime hover:bg-brand-spruce">
              Submit a support request
            </NuxtLink>
          </div>
        </div>
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
          <NuxtLink to="/portal" class="text-white hover:text-brand-lime">
            Submit a request
          </NuxtLink>
          <NuxtLink to="/signup" class="text-white hover:text-brand-lime">
            Create a workspace
          </NuxtLink>
          <NuxtLink to="/login" class="text-white hover:text-brand-lime">
            Sign in
          </NuxtLink>
          <NuxtLink to="/docs" class="text-white hover:text-brand-lime">
            API reference
          </NuxtLink>
        </nav>
      </div>
    </footer>
  </div>
</template>
