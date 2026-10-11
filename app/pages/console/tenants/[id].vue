<script setup lang="ts">
import type { AuditEntry, ClientOnboarding, OrgApp, OrgPlan, SlaTier, TenantSummary } from '~/types/organization'
import { toast } from 'vue-sonner'
import { ORG_APPS, ORG_PLANS } from '~/types/organization'

definePageMeta({ middleware: 'platform' })

const route = useRoute()
const id = computed(() => route.params.id as string)
const { fetchTenant, updateTenant } = useConsole()

const tenant = ref<TenantSummary | null>(null)
const onboarding = ref<ClientOnboarding | null>(null)
const audit = ref<AuditEntry[]>([])
const busy = ref(false)
const origin = useRequestURL().origin

async function load() {
  const result = await fetchTenant(id.value)
  tenant.value = result.tenant
  onboarding.value = result.onboarding
  audit.value = result.audit
}

onMounted(load)

async function save(patch: { status?: 'active' | 'suspended', plan?: OrgPlan, apps?: OrgApp[], slaTier?: SlaTier | null }, message: string) {
  busy.value = true
  try {
    await updateTenant(id.value, patch)
    await load()
    toast(message)
  }
  catch (error: any) {
    toast.error('Could not update tenant', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    busy.value = false
  }
}

function toggleApp(app: OrgApp, on: boolean) {
  if (!tenant.value)
    return
  const apps = on ? [...tenant.value.apps, app] : tenant.value.apps.filter(a => a !== app)
  if (!apps.length) {
    toast.error('Keep at least one app switched on')
    return
  }
  save({ apps }, 'Apps updated')
}

const confirmSuspend = ref(false)

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <NuxtLink to="/console/tenants" class="self-start text-sm text-muted-foreground hover:underline">
      ← All tenants
    </NuxtLink>

    <p v-if="!tenant" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="text-sm text-muted-foreground">
            Tenant · {{ tenant.slug }}
          </div>
          <h2 class="text-3xl font-black tracking-[-0.04em] text-foreground">
            {{ tenant.name }}
          </h2>
        </div>
        <div class="flex items-center gap-2">
          <ConsoleStatusBadge :status="tenant.status" />
          <template v-if="!tenant.isHome">
            <Button v-if="tenant.status === 'suspended'" :disabled="busy" @click="save({ status: 'active' }, 'Tenant reactivated')">
              Reactivate
            </Button>
            <Button v-else variant="destructive" :disabled="busy" @click="confirmSuspend = true">
              Suspend
            </Button>
          </template>
        </div>
      </div>

      <div class="grid gap-4 @3xl/main:grid-cols-[1fr_22rem]">
        <div class="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace</CardTitle>
            </CardHeader>
            <CardContent>
              <dl class="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt class="text-xs text-muted-foreground">
                    Sector
                  </dt><dd class="font-semibold">
                    {{ tenant.sector ?? '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">
                    Country · size
                  </dt><dd class="font-semibold">
                    {{ tenant.country ?? '—' }}<template v-if="tenant.size">
                      · {{ tenant.size }}
                    </template>
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">
                    Joined
                  </dt><dd class="font-semibold">
                    {{ formatDateTime(tenant.createdAt) }} · {{ tenant.source === 'self_serve' ? 'self-serve' : tenant.source === 'staff' ? 'staff-led' : 'home' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">
                    Staff
                  </dt><dd class="font-semibold">
                    {{ tenant.staffCount ?? '—' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-xs text-muted-foreground">
                    Open tickets
                  </dt><dd class="font-semibold">
                    {{ tenant.openTicketCount ?? '—' }}
                  </dd>
                </div>
                <div class="min-w-0">
                  <dt class="text-xs text-muted-foreground">
                    Support portal
                  </dt><dd class="truncate font-semibold">
                    <a :href="`${origin}/portal/${tenant.slug}`" target="_blank" rel="noopener" class="underline">/portal/{{ tenant.slug }}</a>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card v-if="!tenant.isHome">
            <CardHeader>
              <CardTitle>Plan, apps &amp; SLA</CardTitle>
              <CardDescription>Apps decide which sections the company's staff see.</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-5">
              <div class="grid gap-4 sm:grid-cols-2">
                <div class="flex flex-col gap-1.5">
                  <Label>Plan</Label>
                  <Select :model-value="tenant.plan" :disabled="busy" @update:model-value="(value) => save({ plan: value as OrgPlan }, 'Plan updated')">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="plan in ORG_PLANS" :key="plan.id" :value="plan.id">
                        {{ plan.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label>SLA tier</Label>
                  <Select :model-value="tenant.slaTier ?? 'none'" :disabled="busy" @update:model-value="(value) => save({ slaTier: value === 'none' ? null : value as SlaTier }, 'SLA tier updated')">
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        No SLA (self-serve terms)
                      </SelectItem>
                      <SelectItem value="standard">
                        Standard
                      </SelectItem>
                      <SelectItem value="gold">
                        Gold
                      </SelectItem>
                      <SelectItem value="platinum">
                        Platinum
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div class="flex flex-col gap-2">
                <Label>Apps</Label>
                <label v-for="app in ORG_APPS" :key="app.id" class="flex items-start gap-3 rounded-xl border p-3">
                  <Switch :model-value="tenant.apps.includes(app.id)" :disabled="busy" @update:model-value="(on) => toggleApp(app.id, !!on)" />
                  <span>
                    <span class="block text-sm font-semibold">{{ app.label }}</span>
                    <span class="block text-xs text-muted-foreground">{{ app.description }}</span>
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        </div>

        <div class="flex flex-col gap-4">
          <Card v-if="onboarding">
            <CardHeader>
              <CardTitle>Onboarding</CardTitle>
              <CardDescription>{{ onboarding.id }} · owner {{ onboarding.ownerName ?? '—' }}</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-2 text-sm">
              <div>SLA: <span class="font-semibold capitalize">{{ onboarding.sla.tier }}</span> · {{ onboarding.sla.uptime }} uptime</div>
              <div>Term: {{ onboarding.csa.term }}</div>
              <Button variant="outline" size="sm" as-child class="self-start">
                <NuxtLink :to="`/console/onboarding/${onboarding.id}`">
                  Open onboarding
                </NuxtLink>
              </Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Audit log</CardTitle>
              <CardDescription>Staff actions on this tenant.</CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-2 text-sm">
              <p v-if="!audit.length" class="text-muted-foreground">
                Nothing recorded yet.
              </p>
              <div v-for="entry in audit" :key="entry.id" class="flex flex-col border-b pb-2 last:border-0 last:pb-0">
                <span><span class="font-medium">{{ entry.actorName ?? 'System' }}</span> · {{ entry.action }}</span>
                <span class="text-xs text-muted-foreground">{{ formatDateTime(entry.at) }}<template v-if="entry.detail"> · {{ entry.detail }}</template></span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog v-model:open="confirmSuspend">
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Suspend {{ tenant.name }}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their staff are signed out and can't sign in, their portal stops taking requests and their API keys stop working. Nothing is deleted; you can reactivate at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="destructive" :disabled="busy" @click="save({ status: 'suspended' }, 'Tenant suspended').then(() => confirmSuspend = false)">
              Suspend tenant
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </template>
  </div>
</template>
