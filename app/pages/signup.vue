<script setup lang="ts">
import type { OrgApp } from '~/types/organization'
import { toast } from 'vue-sonner'
import { ORG_APPS, ORG_SECTORS, ORG_SIZES } from '~/types/organization'

// Self-serve onboarding: account → organisation & sector → apps → invite team. Nothing is
// created until the last step, which provisions the company's own workspace.
definePageMeta({ layout: 'blank' })
useSeoMeta({ title: 'Create your Canopy workspace' })

const STEPS = [
  { title: 'Create your account', aside: 'Set up your organisation in about ten minutes.' },
  { title: 'Organisation & sector', aside: 'Your sector shapes your starting template.' },
  { title: 'Apps & data', aside: 'Pick what you need now. Add more any time.' },
  { title: 'Invite your team', aside: 'Almost there. Bring your people in.' },
] as const

const ROLE_OPTIONS = [
  { value: 'salesperson', label: 'Salesperson' },
  { value: 'sales_manager', label: 'Sales manager' },
  { value: 'service_agent', label: 'Service agent' },
  { value: 'technician', label: 'Technician' },
  { value: 'administrator', label: 'Administrator' },
]

const COUNTRIES = ['Ghana', 'Nigeria', 'Kenya', 'South Africa', 'Côte d\'Ivoire', 'Senegal', 'United Kingdom', 'United States', 'Other']

const step = ref(0)
const busy = ref(false)
const provisioning = ref(false)
const origin = useRequestURL().origin

// Step 1
const firstName = ref('')
const lastName = ref('')
const email = ref('')
const password = ref('')
const acceptTerms = ref(false)

// Step 2
const orgName = ref('')
const slug = ref('')
const slugEdited = ref(false)
const slugStatus = ref<{ available: boolean, reason?: string, slug: string } | null>(null)
const country = ref('Ghana')
const size = ref<string>(ORG_SIZES[1])
const sector = ref<string>(ORG_SECTORS[0].name)

// Step 3
const apps = ref<OrgApp[]>(['service', 'sales'])

// Step 4
const invites = ref<{ email: string, role: string }[]>([{ email: '', role: 'salesperson' }])

onMounted(async () => {
  try {
    const { draft } = await $fetch<{ draft: { firstName: string, lastName: string, email: string, org: { name: string, slug: string, country?: string, size?: string, sector?: string } | null, apps: OrgApp[] | null } | null }>('/api/signup')
    if (!draft)
      return
    firstName.value = draft.firstName
    lastName.value = draft.lastName
    email.value = draft.email
    if (draft.org) {
      orgName.value = draft.org.name
      slug.value = draft.org.slug
      slugEdited.value = true
      country.value = draft.org.country ?? country.value
      size.value = draft.org.size ?? size.value
      sector.value = draft.org.sector ?? sector.value
    }
    if (draft.apps?.length)
      apps.value = draft.apps
    step.value = draft.apps?.length ? 3 : draft.org ? 2 : 1
  }
  catch {}
})

function suggestSlug(name: string) {
  return name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30)
}

watch(orgName, (name) => {
  if (!slugEdited.value)
    slug.value = suggestSlug(name)
})

let slugTimer: ReturnType<typeof setTimeout> | undefined
watch(slug, (value) => {
  slugStatus.value = null
  clearTimeout(slugTimer)
  if (!value.trim())
    return
  slugTimer = setTimeout(async () => {
    try {
      slugStatus.value = await $fetch<{ available: boolean, reason?: string, slug: string }>('/api/signup/slug', { query: { value } })
    }
    catch {}
  }, 350)
})

function errorMessage(error: any) {
  return error?.data?.statusMessage ?? 'Something went wrong. Please try again.'
}

async function submitAccount() {
  busy.value = true
  try {
    await $fetch('/api/signup/account', { method: 'POST', body: { firstName: firstName.value, lastName: lastName.value, email: email.value, password: password.value, acceptTerms: acceptTerms.value } })
    password.value = ''
    step.value = 1
  }
  catch (error) {
    toast.error('Could not continue', { description: errorMessage(error) })
  }
  finally {
    busy.value = false
  }
}

async function submitOrganization() {
  busy.value = true
  try {
    const result = await $fetch<{ slug: string }>('/api/signup/organization', { method: 'POST', body: { name: orgName.value, slug: slug.value, country: country.value, size: size.value, sector: sector.value } })
    slug.value = result.slug
    step.value = 2
  }
  catch (error) {
    toast.error('Could not continue', { description: errorMessage(error) })
  }
  finally {
    busy.value = false
  }
}

function toggleApp(app: OrgApp) {
  apps.value = apps.value.includes(app) ? apps.value.filter(a => a !== app) : [...apps.value, app]
}

async function submitApps() {
  busy.value = true
  try {
    await $fetch('/api/signup/apps', { method: 'POST', body: { apps: apps.value } })
    step.value = 3
  }
  catch (error) {
    toast.error('Could not continue', { description: errorMessage(error) })
  }
  finally {
    busy.value = false
  }
}

const { currentUser, authReady, homePath } = useAuth()

async function complete(withInvites: boolean) {
  provisioning.value = true
  try {
    const result = await $fetch<{ user: any, invites: { email: string, sent: boolean, error?: string }[] }>('/api/signup/complete', {
      method: 'POST',
      body: { invites: withInvites ? invites.value.filter(invite => invite.email.trim()) : [] },
    })
    currentUser.value = result.user
    authReady.value = true
    const failed = result.invites.filter(invite => !invite.sent)
    toast('Your workspace is ready', {
      description: failed.length
        ? `${failed.length} invite${failed.length === 1 ? '' : 's'} couldn't be sent. Resend from Admin → Staff.`
        : result.invites.length ? `Invites sent to ${result.invites.length} ${result.invites.length === 1 ? 'person' : 'people'}.` : undefined,
    })
    await navigateTo(homePath.value)
  }
  catch (error) {
    provisioning.value = false
    toast.error('Could not create your workspace', { description: errorMessage(error) })
  }
}

const canContinue = computed(() => {
  if (step.value === 0)
    return !!(firstName.value.trim() && lastName.value.trim() && email.value.trim() && password.value.length >= 12 && acceptTerms.value)
  if (step.value === 1)
    return !!(orgName.value.trim() && slugStatus.value?.available)
  if (step.value === 2)
    return apps.value.length > 0
  return true
})

function back() {
  step.value = Math.max(0, step.value - 1)
}

const inputClass = 'min-h-12 w-full rounded-[10px] border border-[#868685] bg-white px-4 text-base font-normal text-brand-obsidian outline-none focus-visible:border-brand-forest focus-visible:ring-[3px] focus-visible:ring-brand-forest/25'
const labelClass = 'flex flex-col gap-1.5 text-sm font-semibold text-brand-forest'
</script>

<template>
  <div class="flex min-h-screen flex-wrap bg-white font-sans text-[#454745]">
    <!-- Progress -->
    <aside class="flex min-w-0 flex-[1_1_360px] flex-col gap-10 bg-brand-forest p-8 md:max-w-[520px] md:p-10">
      <NuxtLink to="/" aria-label="Canopy home" class="self-start">
        <BrandLogo tone="dark" :size="34" />
      </NuxtLink>
      <p class="m-0 text-[clamp(2.25rem,4vw,3.25rem)] font-black leading-[0.92] tracking-[-0.05em] text-white">
        {{ STEPS[step]!.aside }}
      </p>
      <ol aria-label="Setup steps" class="m-0 flex list-none flex-col gap-2.5 p-0">
        <li
          v-for="(item, index) in STEPS"
          :key="item.title"
          :aria-current="index === step ? 'step' : undefined"
          class="flex items-center gap-3.5 rounded-2xl px-4 py-3.5"
          :class="index === step ? 'bg-brand-lime font-bold text-brand-forest' : index < step ? 'font-medium text-white' : 'font-medium text-brand-mist'"
        >
          <span
            class="flex size-[30px] shrink-0 items-center justify-center rounded-full text-sm"
            :class="index === step ? 'bg-brand-forest text-brand-lime' : index < step ? 'bg-brand-spruce' : 'border-2 border-brand-mist'"
          >
            <svg v-if="index < step" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="text-brand-lime" aria-hidden="true"><path d="M5 12l5 5 9-10" /></svg>
            <template v-else>{{ index + 1 }}</template>
          </span>
          {{ item.title }}
          <span v-if="index < step" class="sr-only">(done)</span>
        </li>
      </ol>
    </aside>

    <main class="flex min-w-0 max-w-[860px] flex-[999_1_480px] flex-col gap-6 px-6 py-12 md:px-[clamp(24px,6vw,96px)] md:py-14">
      <div class="text-sm font-semibold text-[#5d605d]">
        Step {{ step + 1 }} of {{ STEPS.length }}
      </div>

      <!-- 1 · Account -->
      <form v-if="step === 0" class="flex flex-col gap-6" @submit.prevent="canContinue && submitAccount()">
        <h1 class="m-0 text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-obsidian">
          Create your account
        </h1>
        <p class="m-0 text-lg leading-normal">
          You'll be the organisation's first administrator. You can add more admins later.
        </p>
        <div class="grid gap-4 sm:grid-cols-2">
          <label :class="labelClass">First name<input v-model="firstName" type="text" autocomplete="given-name" required :class="inputClass"></label>
          <label :class="labelClass">Last name<input v-model="lastName" type="text" autocomplete="family-name" required :class="inputClass"></label>
        </div>
        <label :class="labelClass">Work email<input v-model="email" type="email" autocomplete="email" placeholder="you@company.com" required :class="inputClass"></label>
        <label :class="labelClass">Password
          <input v-model="password" type="password" autocomplete="new-password" minlength="12" required :class="inputClass">
          <span class="text-[13px] font-normal text-[#5d605d]">At least 12 characters.</span>
        </label>
        <label class="flex items-start gap-3 text-[15px] leading-normal">
          <input v-model="acceptTerms" type="checkbox" class="mt-0.5 size-[22px] shrink-0 accent-brand-forest">
          <span>I agree to the Terms of Service and Data Processing Agreement on behalf of my organisation.</span>
        </label>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <span class="text-[15px]">Already have an account? <NuxtLink to="/login" class="font-semibold text-brand-forest underline">Sign in</NuxtLink></span>
          <button type="submit" :disabled="!canContinue || busy" class="min-h-12 rounded-full bg-brand-lime px-8 text-[17px] font-semibold text-brand-forest disabled:opacity-50">
            {{ busy ? 'Checking…' : 'Continue' }}
          </button>
        </div>
      </form>

      <!-- 2 · Organisation & sector -->
      <form v-else-if="step === 1" class="flex flex-col gap-6" @submit.prevent="canContinue && submitOrganization()">
        <h1 class="m-0 text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-obsidian">
          Tell us about your organisation
        </h1>
        <div class="grid gap-4 sm:grid-cols-2">
          <label :class="labelClass">Organisation name<input v-model="orgName" type="text" autocomplete="organization" required :class="inputClass"></label>
          <label :class="labelClass">Workspace address
            <input v-model="slug" type="text" placeholder="yourcompany" required :class="inputClass" aria-describedby="slug-help" @input="slugEdited = true">
            <span id="slug-help" class="text-[13px] font-normal" :class="slugStatus && !slugStatus.available ? 'text-destructive' : 'text-[#5d605d]'">
              <template v-if="slugStatus && !slugStatus.available">{{ slugStatus.reason }}</template>
              <template v-else>Your customers' support portal: {{ origin }}/portal/{{ slugStatus?.slug || slug || 'yourcompany' }}</template>
            </span>
          </label>
          <label :class="labelClass">Country
            <select v-model="country" :class="inputClass">
              <option v-for="option in COUNTRIES" :key="option">{{ option }}</option>
            </select>
          </label>
          <label :class="labelClass">Organisation size
            <select v-model="size" :class="inputClass">
              <option v-for="option in ORG_SIZES" :key="option">{{ option }}</option>
            </select>
          </label>
        </div>
        <fieldset class="m-0 flex flex-col gap-2.5 border-0 p-0">
          <legend class="mb-2.5 text-sm font-semibold text-brand-forest">
            Sector
          </legend>
          <div class="grid grid-cols-2 gap-2.5 md:grid-cols-4">
            <button
              v-for="option in ORG_SECTORS"
              :key="option.name"
              type="button"
              :aria-pressed="sector === option.name"
              class="min-h-[84px] rounded-2xl p-4 text-left"
              :class="sector === option.name ? 'border-2 border-brand-forest bg-brand-forest text-white' : 'border border-[#868685] bg-white text-brand-forest'"
              @click="sector = option.name"
            >
              <span class="block text-base font-bold">{{ option.name }}</span>
              <span class="mt-1 block text-[13px] opacity-85">{{ option.hint }}</span>
            </button>
          </div>
        </fieldset>
        <p class="m-0 text-[13px] text-[#5d605d]">
          Your workspace's data is stored in its own database in the United States (East) region.
        </p>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="min-h-12 rounded-full border border-brand-forest px-7 font-medium text-brand-forest" @click="back">
            Back
          </button>
          <button type="submit" :disabled="!canContinue || busy" class="min-h-12 rounded-full bg-brand-lime px-8 text-[17px] font-semibold text-brand-forest disabled:opacity-50">
            {{ busy ? 'Saving…' : 'Continue' }}
          </button>
        </div>
      </form>

      <!-- 3 · Apps & data -->
      <form v-else-if="step === 2" class="flex flex-col gap-6" @submit.prevent="canContinue && submitApps()">
        <h1 class="m-0 text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-obsidian">
          Choose your apps
        </h1>
        <p class="m-0 text-[17px] leading-normal">
          <b class="text-brand-forest">{{ apps.length }} selected.</b> Every app shares the same customer records. Calendar, email and chat are always included.
        </p>
        <div class="grid gap-2.5 sm:grid-cols-2">
          <button
            v-for="app in ORG_APPS"
            :key="app.id"
            type="button"
            :aria-pressed="apps.includes(app.id)"
            class="rounded-[20px] p-[18px] text-left"
            :class="apps.includes(app.id) ? 'border-2 border-brand-forest bg-brand-forest text-white' : 'border border-[#868685] bg-white text-brand-forest'"
            @click="toggleApp(app.id)"
          >
            <span class="flex items-center justify-between text-lg font-extrabold tracking-[-0.02em]">
              {{ app.label }}
              <span v-if="apps.includes(app.id)" class="flex size-7 items-center justify-center rounded-full bg-brand-lime text-brand-forest" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10" /></svg>
              </span>
            </span>
            <span class="mt-1.5 block text-sm leading-snug opacity-90">{{ app.description }}</span>
          </button>
        </div>
        <section class="flex flex-col gap-2 rounded-[28px] bg-brand-fog p-6">
          <h2 class="m-0 text-lg font-bold text-brand-obsidian">
            Bring in your existing data
          </h2>
          <p class="m-0 text-[15px] leading-normal">
            Once you're in, each person can connect their own Gmail, Slack and AI assistant under Settings → Integrations,
            and admins can link an ERP under Integrations → ERP Connections to sync customers and projects.
          </p>
        </section>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="min-h-12 rounded-full border border-brand-forest px-7 font-medium text-brand-forest" @click="back">
            Back
          </button>
          <button type="submit" :disabled="!canContinue || busy" class="min-h-12 rounded-full bg-brand-lime px-8 text-[17px] font-semibold text-brand-forest disabled:opacity-50">
            {{ busy ? 'Saving…' : 'Continue' }}
          </button>
        </div>
      </form>

      <!-- 4 · Invite team -->
      <form v-else class="flex flex-col gap-6" @submit.prevent="complete(true)">
        <h1 class="m-0 text-[clamp(2.5rem,5vw,3.5rem)] font-black leading-[0.95] tracking-[-0.05em] text-brand-obsidian">
          Invite your team
        </h1>
        <p class="m-0 text-[17px] leading-normal">
          Roles set what each person can see and change. You can change roles later in Admin → Staff.
        </p>
        <div class="flex flex-col gap-2.5">
          <div v-for="(invite, index) in invites" :key="index" class="flex flex-wrap items-end gap-2.5">
            <label class="flex flex-[2_1_260px] flex-col gap-1.5 text-[13px] font-semibold text-brand-forest">Email
              <input v-model="invite.email" type="email" placeholder="colleague@company.com" :class="inputClass">
            </label>
            <label class="flex flex-[1_1_180px] flex-col gap-1.5 text-[13px] font-semibold text-brand-forest">Role
              <select v-model="invite.role" :class="inputClass">
                <option v-for="option in ROLE_OPTIONS" :key="option.value" :value="option.value">{{ option.label }}</option>
              </select>
            </label>
            <button type="button" class="min-h-12 rounded-full px-4 text-sm font-medium text-brand-forest hover:bg-brand-mist" :aria-label="`Remove ${invite.email || 'this invite'}`" @click="invites.splice(index, 1)">
              Remove
            </button>
          </div>
          <button type="button" class="self-start rounded-full border border-brand-forest px-5 py-2.5 text-[15px] font-medium text-brand-forest" @click="invites.push({ email: '', role: 'salesperson' })">
            + Add another
          </button>
        </div>
        <section class="grid gap-4 rounded-[28px] bg-brand-mist p-6 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div class="text-[13px] text-brand-spruce">
              Workspace
            </div>
            <div class="mt-1 font-bold text-brand-forest">
              {{ orgName }}
            </div>
          </div>
          <div>
            <div class="text-[13px] text-brand-spruce">
              Sector
            </div>
            <div class="mt-1 font-bold text-brand-forest">
              {{ sector }}
            </div>
          </div>
          <div>
            <div class="text-[13px] text-brand-spruce">
              Apps
            </div>
            <div class="mt-1 font-bold text-brand-forest">
              {{ ORG_APPS.filter(app => apps.includes(app.id)).map(app => app.label).join(', ') }}
            </div>
          </div>
          <div class="min-w-0">
            <div class="text-[13px] text-brand-spruce">
              Support portal
            </div>
            <div class="mt-1 truncate font-bold text-brand-forest">
              /portal/{{ slug }}
            </div>
          </div>
        </section>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <button type="button" class="min-h-12 rounded-full border border-brand-forest px-7 font-medium text-brand-forest" :disabled="provisioning" @click="back">
            Back
          </button>
          <div class="flex flex-wrap items-center gap-3">
            <button type="button" class="px-2 font-medium text-brand-forest underline" :disabled="provisioning" @click="complete(false)">
              Skip for now
            </button>
            <button type="submit" :disabled="provisioning" class="min-h-12 rounded-full bg-brand-forest px-8 text-[17px] font-semibold text-brand-lime disabled:opacity-60">
              Send invites &amp; open Canopy
            </button>
          </div>
        </div>
      </form>
    </main>

    <!-- Provisioning -->
    <div v-if="provisioning" class="fixed inset-0 z-50 flex items-center justify-center bg-brand-forest/95 p-6" role="status" aria-live="polite">
      <div class="flex max-w-md flex-col items-center gap-5 text-center">
        <BrandLogo tone="dark" :size="72" :wordmark="false" class="animate-pulse" />
        <p class="m-0 text-3xl font-black tracking-[-0.04em] text-white">
          Setting up {{ orgName }}…
        </p>
        <p class="m-0 text-brand-mist">
          Creating your workspace and its database. This usually takes a few seconds.
        </p>
      </div>
    </div>
  </div>
</template>
