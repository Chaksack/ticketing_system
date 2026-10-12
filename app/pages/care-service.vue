<script setup lang="ts">
// Public: the Canopy Care service page ("Canopy Care — service page" in the Canopy design).
definePageMeta({ layout: 'blank' })
useSeoMeta({
  title: 'Canopy Care: your customer service team, without building one',
  description: 'Canopy Care agents answer your customers under your brand, inside your own Canopy workspace.',
})

const STATS = [
  { title: '24 × 7', copy: 'Coverage options, nights and weekends included', tone: 'bg-brand-forest', titleClass: 'text-brand-lime', copyClass: 'text-white' },
  { title: 'Chat & email', copy: 'Web chat and email today, in your own support portal', tone: 'bg-brand-mist', titleClass: 'text-brand-forest', copyClass: '' },
  { title: 'Your data', copy: 'Cases stay in your workspace — always', tone: 'bg-brand-fog', titleClass: 'text-brand-forest', copyClass: '' },
  { title: 'SLA-backed', copy: 'Response targets agreed in writing', tone: 'bg-brand-lime', titleClass: 'text-brand-forest', copyClass: 'text-brand-forest' },
]
const STEPS = [
  { title: 'Tell us your volumes', copy: 'Channels, hours, languages and what customers usually ask.' },
  { title: 'Agree the SLA', copy: 'Response targets, quality scorecard and escalation paths in writing.' },
  { title: 'We train the team', copy: 'On your products, your tone and your knowledge base.' },
  { title: 'Go live and watch', copy: 'Every conversation and score on your results page.' },
]
const SERVICES = [
  { title: 'Inbound support', copy: 'Questions, complaints, account help and order tracking.', tone: 'bg-brand-mist' },
  { title: 'Overflow & after-hours', copy: 'We pick up when your team is busy or closed.', tone: 'bg-brand-fog' },
  { title: 'Technical helpdesk', copy: 'First- and second-line troubleshooting with clean hand-offs.', tone: 'bg-brand-fog' },
  { title: 'Outbound', copy: 'Reminders, renewals, welcome calls and surveys.', tone: 'bg-brand-mist' },
  { title: 'Back office', copy: 'Order processing, claims intake and document checks.', tone: 'bg-brand-mist' },
]
const MODELS = [
  { name: 'Shared pool', basis: 'per handled conversation', copy: 'Best for after-hours and smaller volumes.', featured: false },
  { name: 'Dedicated team', basis: 'per agent per month', copy: 'Agents who only handle your brand.', featured: true },
  { name: 'Outcome-based', basis: 'per resolved case', copy: 'Tied to resolution and quality targets.', featured: false },
]
const VOLUMES = ['Under 1,000', '1,000 – 10,000', '10,000 – 50,000', '50,000+']

const form = reactive({ email: '', volume: VOLUMES[0]!, website: '', busy: false, sent: false, error: '' })
async function submit() {
  form.error = ''
  if (!/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/.test(form.email.trim())) {
    form.error = 'Enter a valid work email, like you@company.com'
    return
  }
  form.busy = true
  try {
    await $fetch('/api/demo-request', { method: 'POST', body: { email: form.email, volume: form.volume, interest: 'care', website: form.website } })
    form.sent = true
  }
  catch (e: any) {
    form.error = e?.data?.statusMessage ?? 'Something went wrong. Please try again.'
  }
  finally {
    form.busy = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-white font-sans text-[#454745]">
    <header class="border-b border-brand-fog">
      <nav aria-label="Main" class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <NuxtLink to="/" aria-label="Canopy home" class="flex items-center gap-2.5 no-underline">
          <BrandLogo tone="light" :size="34" />
          <span class="rounded-full bg-brand-lime px-2.5 py-1 text-[13px] font-bold text-brand-forest">Care</span>
        </NuxtLink>
        <div class="hidden flex-wrap gap-1 md:flex">
          <a href="#how" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">How it works</a>
          <a href="#services" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">Services</a>
          <a href="#models" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">Pricing models</a>
          <NuxtLink to="/" class="rounded-full px-4 py-2.5 font-medium text-brand-forest hover:bg-brand-mist">
            Canopy software
          </NuxtLink>
        </div>
        <a href="#talk" class="inline-flex min-h-11 items-center rounded-full bg-brand-lime px-6 font-semibold text-brand-forest hover:bg-brand-lime/85">Talk to us</a>
      </nav>
    </header>

    <main>
      <section class="mx-auto flex max-w-6xl flex-col gap-6 px-6 pb-16 pt-16 md:pt-20">
        <h1 class="m-0 max-w-5xl text-[clamp(3.25rem,9vw,6.75rem)] font-black leading-[0.88] tracking-[-0.05em] text-brand-obsidian">
          Your customer service team. Without building one.
        </h1>
        <p class="m-0 max-w-2xl text-lg leading-relaxed md:text-[22px] md:leading-[1.45]">
          Canopy Care agents answer your customers under your brand, inside your own Canopy workspace — so you keep every customer record and see every conversation.
        </p>
        <div class="flex flex-wrap gap-3">
          <a href="#talk" class="inline-flex min-h-12 items-center rounded-full bg-brand-forest px-7 text-lg font-semibold text-brand-lime hover:bg-brand-spruce">Get a staffing plan</a>
          <NuxtLink to="/signup" class="inline-flex min-h-12 items-center rounded-full border border-brand-forest px-7 text-lg font-medium text-brand-forest hover:bg-brand-mist">
            Start with the software
          </NuxtLink>
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="stat in STATS" :key="stat.title" class="rounded-[28px] p-6" :class="stat.tone">
            <div class="text-3xl font-black tracking-[-0.04em]" :class="stat.titleClass">
              {{ stat.title }}
            </div>
            <div class="mt-1.5" :class="stat.copyClass">
              {{ stat.copy }}
            </div>
          </div>
        </div>
      </section>

      <section id="how" class="scroll-mt-6 bg-brand-forest px-6 py-20">
        <div class="mx-auto flex max-w-6xl flex-col gap-7">
          <h2 class="m-0 text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-lime">
            Live in weeks, not quarters.
          </h2>
          <ol class="m-0 grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-4">
            <li v-for="(step, index) in STEPS" :key="step.title" class="rounded-[28px] p-6" :class="index === STEPS.length - 1 ? 'bg-brand-lime text-brand-forest' : 'bg-brand-spruce text-white'">
              <div class="text-[40px] font-black tracking-[-0.04em]" :class="index === STEPS.length - 1 ? '' : 'text-brand-lime'">
                {{ String(index + 1).padStart(2, '0') }}
              </div>
              <b class="text-lg">{{ step.title }}</b>
              <p class="m-0 mt-1.5 leading-normal" :class="index === STEPS.length - 1 ? '' : 'text-brand-mist'">
                {{ step.copy }}
              </p>
            </li>
          </ol>
        </div>
      </section>

      <section id="services" class="mx-auto flex max-w-6xl scroll-mt-6 flex-col gap-7 px-6 py-20">
        <h2 class="m-0 text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-obsidian">
          What we can take off your hands
        </h2>
        <div class="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
          <div v-for="service in SERVICES" :key="service.title" class="rounded-[28px] p-6" :class="service.tone">
            <b class="text-[22px] text-brand-forest">{{ service.title }}</b>
            <p class="m-0 mt-2 leading-normal">
              {{ service.copy }}
            </p>
          </div>
          <div class="rounded-[28px] bg-brand-forest p-6">
            <b class="text-[22px] text-brand-lime">Build, run, hand over</b>
            <p class="m-0 mt-2 leading-normal text-white">
              When you're ready to bring support in-house, the workspace, workflows and knowledge base stay yours.
            </p>
          </div>
        </div>
      </section>

      <section id="models" class="scroll-mt-6 bg-brand-fog px-6 py-20">
        <div class="mx-auto flex max-w-6xl flex-col gap-7">
          <h2 class="m-0 text-[clamp(2.5rem,6vw,4rem)] font-black leading-[0.95] tracking-[-0.045em] text-brand-obsidian">
            Pay the way that fits your volume
          </h2>
          <div class="grid gap-3.5 md:grid-cols-3">
            <div v-for="model in MODELS" :key="model.name" class="flex flex-col gap-2.5 rounded-[28px] p-7" :class="model.featured ? 'bg-brand-forest' : 'bg-white'">
              <b class="text-xl" :class="model.featured ? 'text-brand-lime' : 'text-brand-forest'">{{ model.name }}</b>
              <div class="text-[34px] font-black leading-tight tracking-[-0.04em]" :class="model.featured ? 'text-white' : 'text-brand-obsidian'">
                Quoted
              </div>
              <div :class="model.featured ? 'text-brand-mist' : ''">
                {{ model.basis }}
              </div>
              <p class="m-0 leading-normal" :class="model.featured ? 'text-white' : ''">
                {{ model.copy }}
              </p>
            </div>
          </div>
          <p class="m-0 text-sm">
            Every model includes the Canopy software for your team. We send a staffing plan and price once we know your volumes.
          </p>
        </div>
      </section>

      <section id="talk" class="mx-auto max-w-6xl scroll-mt-6 px-6 py-20">
        <div class="grid items-center gap-8 rounded-[28px] bg-brand-lime p-8 md:grid-cols-2 md:p-16">
          <h2 class="m-0 text-[clamp(2.5rem,6vw,4.5rem)] font-black leading-[0.9] tracking-[-0.05em] text-brand-forest">
            Get a staffing plan in 48 hours.
          </h2>
          <div v-if="form.sent" role="status" class="rounded-2xl bg-brand-forest p-6 text-white">
            <span class="text-2xl font-black tracking-[-0.03em] text-brand-lime">Thanks, we've got it.</span>
            <p class="m-0 mt-2 text-brand-mist">
              We'll email {{ form.email }} with a staffing plan.
            </p>
          </div>
          <form v-else class="flex flex-col gap-3" novalidate @submit.prevent="submit">
            <label class="flex flex-col gap-1.5 text-sm font-semibold text-brand-forest">Work email
              <input v-model="form.email" type="email" autocomplete="email" placeholder="you@company.com" class="min-h-12 rounded-xl border border-brand-forest bg-white px-4 text-base font-normal text-brand-obsidian outline-none focus-visible:ring-2 focus-visible:ring-brand-forest">
            </label>
            <label class="flex flex-col gap-1.5 text-sm font-semibold text-brand-forest">Contacts per month (roughly)
              <select v-model="form.volume" class="min-h-12 rounded-xl border border-brand-forest bg-white px-4 text-base font-normal text-brand-obsidian outline-none focus-visible:ring-2 focus-visible:ring-brand-forest">
                <option v-for="volume in VOLUMES" :key="volume" :value="volume">{{ volume }}</option>
              </select>
            </label>
            <input v-model="form.website" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="absolute -left-[9999px] h-0 w-0 opacity-0">
            <p class="m-0 min-h-5 text-sm font-semibold text-[#8a1c1c]" aria-live="polite">
              {{ form.error }}
            </p>
            <button type="submit" :disabled="form.busy" class="min-h-13 rounded-full bg-brand-forest px-7 text-[17px] font-semibold text-brand-lime disabled:opacity-70">
              {{ form.busy ? 'Sending…' : 'Request my plan' }}
            </button>
          </form>
        </div>
      </section>
    </main>

    <footer class="bg-brand-forest px-6 py-14">
      <div class="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-6">
        <BrandLogo tone="dark" :size="34" />
        <nav aria-label="Footer" class="flex flex-wrap gap-6 text-[15px]">
          <NuxtLink to="/" class="text-white hover:text-brand-lime">
            Canopy software
          </NuxtLink>
          <a href="#models" class="text-white hover:text-brand-lime">Pricing models</a>
          <a href="#talk" class="text-white hover:text-brand-lime">Contact</a>
        </nav>
      </div>
    </footer>
  </div>
</template>
