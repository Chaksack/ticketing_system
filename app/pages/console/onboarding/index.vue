<script setup lang="ts">
import type { ClientOnboarding } from '~/types/organization'
import { toast } from 'vue-sonner'
import { ORG_PLANS } from '~/types/organization'

definePageMeta({ middleware: 'platform' })

const { fetchOnboardings, createOnboarding } = useConsole()
const onboardings = ref<ClientOnboarding[] | null>(null)
const newClientName = ref('')
const creating = ref(false)

onMounted(async () => {
  onboardings.value = await fetchOnboardings()
})

async function onCreate() {
  if (!newClientName.value.trim())
    return
  creating.value = true
  try {
    const onboarding = await createOnboarding(newClientName.value)
    await navigateTo(`/console/onboarding/${onboarding.id}`)
  }
  catch (error: any) {
    toast.error('Could not start onboarding', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    creating.value = false
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <div>
      <div class="text-sm text-muted-foreground">
        Canopy staff console
      </div>
      <h1 class="text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
        Client onboarding
      </h1>
      <p class="text-muted-foreground">
        Staff-led onboarding: client details, plan and apps, CSA &amp; SLA terms, signature, then provisioning.
      </p>
    </div>

    <form class="flex flex-wrap items-end gap-2" @submit.prevent="onCreate">
      <div class="flex min-w-[260px] flex-1 flex-col gap-1.5 sm:max-w-md">
        <Label for="new-client">New client</Label>
        <Input id="new-client" v-model="newClientName" placeholder="e.g. Accra Fresh Foods" />
      </div>
      <Button type="submit" :disabled="!newClientName.trim() || creating">
        <Icon name="i-lucide-plus" class="size-4" />
        Start onboarding
      </Button>
    </form>

    <div class="overflow-x-auto rounded-3xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>SLA</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-if="!onboardings">
            <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
              Loading…
            </TableCell>
          </TableRow>
          <TableRow v-else-if="!onboardings.length">
            <TableCell :colspan="6" class="h-20 text-center text-muted-foreground">
              No onboardings yet. Start one above.
            </TableCell>
          </TableRow>
          <TableRow v-for="item in onboardings" :key="item.id">
            <TableCell>
              <NuxtLink :to="`/console/onboarding/${item.id}`" class="font-semibold hover:underline">
                {{ item.clientName }}
              </NuxtLink>
              <div class="text-xs text-muted-foreground">
                {{ item.id }}<template v-if="item.sector">
                  · {{ item.sector }}
                </template>
              </div>
            </TableCell>
            <TableCell>{{ ORG_PLANS.find(p => p.id === item.plan)?.label }}</TableCell>
            <TableCell class="capitalize">
              {{ item.sla.tier }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ item.ownerName ?? '—' }}
            </TableCell>
            <TableCell class="whitespace-nowrap text-muted-foreground">
              {{ formatDate(item.updatedAt) }}
            </TableCell>
            <TableCell>
              <ConsoleStatusBadge :status="item.status" />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
