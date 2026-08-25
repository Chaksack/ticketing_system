<script setup lang="ts">
import NumberFlow from '@number-flow/vue'
import { stages } from '~/components/clients/data'

definePageMeta({
  middleware: 'bd',
})

const { clients, upcomingRenewals, fetchClients, fetchUpcomingRenewals } = useClients()

onMounted(() => {
  fetchClients()
  fetchUpcomingRenewals()
})

const totalClients = computed(() => clients.value.length)
const activeContracts = computed(() => clients.value.reduce((sum, c) => sum + (c.activeContractCount ?? 0), 0))
const renewalsDueSoon = computed(() => upcomingRenewals.value.filter((r) => {
  const daysRemaining = (new Date(r.endDate).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
  return daysRemaining <= 30
}).length)

const stageData = computed(() => stages.map(stage => ({
  stage: stage.label,
  count: clients.value.filter(c => c.stage === stage.value).length,
})).filter(row => row.count > 0))

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function daysUntil(value: string) {
  return Math.ceil((new Date(value).getTime() - Date.now()) / (24 * 60 * 60 * 1000))
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Overview
      </h2>
      <p class="text-muted-foreground">
        Clients, AMC contracts, and renewals at a glance.
      </p>
    </div>

    <main class="@container/main flex flex-1 flex-col gap-4 md:gap-8">
      <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-3">
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>Total Clients</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <NumberFlow :value="totalClients" />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>Active AMC Contracts</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <NumberFlow :value="activeContracts" />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>Renewals Due in 30 Days</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <NumberFlow :value="renewalsDueSoon" />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div class="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Clients by Stage</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart v-if="stageData.length" :data="stageData" category="count" index="stage" />
            <p v-else class="text-sm text-muted-foreground">
              No clients yet.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming Renewals</CardTitle>
            <CardDescription>Soonest-expiring active AMC contracts</CardDescription>
          </CardHeader>
          <CardContent class="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <template v-if="upcomingRenewals.length">
                  <TableRow v-for="renewal in upcomingRenewals" :key="renewal.contractId">
                    <TableCell class="font-medium">
                      <NuxtLink :to="`/clients?open=${renewal.clientId}`" class="hover:underline">
                        {{ renewal.clientName }}
                      </NuxtLink>
                    </TableCell>
                    <TableCell class="text-muted-foreground">
                      {{ renewal.planName }}
                    </TableCell>
                    <TableCell>
                      <span :class="daysUntil(renewal.endDate) <= 7 ? 'text-destructive font-medium' : ''">
                        {{ formatDate(renewal.endDate) }}
                      </span>
                    </TableCell>
                  </TableRow>
                </template>
                <TableRow v-else>
                  <TableCell :colspan="3" class="h-24 text-center text-muted-foreground">
                    No active AMC contracts.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  </div>
</template>
