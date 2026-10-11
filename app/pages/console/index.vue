<script setup lang="ts">
import type { ConsoleOverview } from '~/composables/useConsole'

definePageMeta({ middleware: 'platform' })

const { fetchOverview } = useConsole()
const overview = ref<ConsoleOverview | null>(null)

onMounted(async () => {
  overview.value = await fetchOverview()
})

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-5">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <div class="text-sm text-muted-foreground">
          Canopy staff console
        </div>
        <h2 class="text-3xl font-black tracking-[-0.04em] text-foreground">
          Console overview
        </h2>
      </div>
      <div class="flex gap-2">
        <Button variant="outline" as-child>
          <NuxtLink to="/console/tenants">
            All tenants
          </NuxtLink>
        </Button>
        <Button as-child>
          <NuxtLink to="/console/onboarding">
            <Icon name="i-lucide-file-signature" class="size-4" />
            Client onboarding
          </NuxtLink>
        </Button>
      </div>
    </div>

    <p v-if="!overview" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <template v-else>
      <div class="grid grid-cols-2 gap-4 @3xl/main:grid-cols-4">
        <div class="rounded-3xl bg-brand-forest p-5 text-white">
          <div class="text-sm text-brand-mist">
            Active tenants
          </div>
          <div class="mt-1.5 text-4xl font-black tracking-[-0.04em] text-brand-lime">
            {{ overview.tenants.active }}
          </div>
          <div class="mt-1 text-[13px]">
            {{ overview.tenants.newThisWeek }} new this week
          </div>
        </div>
        <div class="rounded-3xl border bg-card p-5">
          <div class="text-sm text-muted-foreground">
            Suspended
          </div>
          <div class="mt-1.5 text-4xl font-black tracking-[-0.04em]">
            {{ overview.tenants.suspended }}
          </div>
          <div class="mt-1 text-[13px] text-muted-foreground">
            Can't sign in until reactivated
          </div>
        </div>
        <div class="rounded-3xl border bg-card p-5">
          <div class="text-sm text-muted-foreground">
            How they joined
          </div>
          <div class="mt-1.5 text-4xl font-black tracking-[-0.04em]">
            {{ overview.tenants.selfServe }}<span class="text-xl text-muted-foreground"> / {{ overview.tenants.staffLed }}</span>
          </div>
          <div class="mt-1 text-[13px] text-muted-foreground">
            Self-serve / staff-led
          </div>
        </div>
        <div class="rounded-3xl bg-brand-mist p-5 text-brand-forest dark:bg-accent dark:text-accent-foreground">
          <div class="text-sm">
            Onboarding in progress
          </div>
          <div class="mt-1.5 text-4xl font-black tracking-[-0.04em]">
            {{ overview.onboardings.draft + overview.onboardings.signed }}
          </div>
          <div class="mt-1 text-[13px]">
            {{ overview.onboardings.signed }} signed, ready to provision
          </div>
        </div>
      </div>

      <div class="grid gap-4 @3xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Newest tenants</CardTitle>
          </CardHeader>
          <CardContent class="flex flex-col gap-2">
            <p v-if="!overview.recentTenants.length" class="text-sm text-muted-foreground">
              No companies yet. They appear here when they sign up or you provision one.
            </p>
            <NuxtLink v-for="tenant in overview.recentTenants" :key="tenant.id" :to="`/console/tenants/${tenant.id}`" class="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 hover:bg-accent">
              <div class="min-w-0">
                <div class="truncate font-semibold">
                  {{ tenant.name }}
                </div>
                <div class="text-xs text-muted-foreground">
                  {{ tenant.slug }} · {{ tenant.sector ?? 'No sector' }} · {{ tenant.source === 'self_serve' ? 'Self-serve' : 'Staff-led' }}
                </div>
              </div>
              <ConsoleStatusBadge :status="tenant.status" />
            </NuxtLink>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Recent staff actions</CardTitle>
            <CardDescription>Every staff action on a tenant is logged.</CardDescription>
          </CardHeader>
          <CardContent class="flex flex-col gap-2 text-sm">
            <p v-if="!overview.recentAudit.length" class="text-muted-foreground">
              Nothing yet.
            </p>
            <div v-for="entry in overview.recentAudit" :key="entry.id" class="flex flex-col border-b pb-2 last:border-0 last:pb-0">
              <span><span class="font-medium">{{ entry.actorName ?? 'System' }}</span> · {{ entry.action }}<template v-if="entry.orgId"> · {{ entry.orgId }}</template></span>
              <span class="text-xs text-muted-foreground">{{ formatDateTime(entry.at) }}<template v-if="entry.detail"> · {{ entry.detail }}</template></span>
            </div>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
