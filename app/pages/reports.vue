<script setup lang="ts">
import NumberFlow from '@number-flow/vue'

definePageMeta({
  middleware: 'admin',
})

const { summary, fetchSummary } = useReports()

interface Satisfaction { sent: number, responses: number, average: number | null, distribution: { score: string, count: number }[], recentComments: { ticketId: string, subject: string, rating: number, comment: string, at: string }[] }
const satisfaction = ref<Satisfaction | null>(null)

onMounted(async () => {
  await fetchSummary()
  satisfaction.value = await fetchUntyped<Satisfaction>('/api/reports/satisfaction').catch(() => null)
})

function formatMins(mins: number | null) {
  if (mins === null)
    return '—'
  if (mins < 60)
    return `${mins}m`
  const hours = mins / 60
  return `${hours.toFixed(1)}h`
}

const statusData = computed(() => Object.entries(summary.value?.byStatus ?? {}).map(([status, count]) => ({ status, count })))
const priorityData = computed(() => Object.entries(summary.value?.byPriority ?? {}).map(([priority, count]) => ({ priority, count })))
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div>
      <h1 class="text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
        Reports
      </h1>
      <p class="text-muted-foreground">
        Ticket volume, SLA compliance, and agent performance.
      </p>
    </div>

    <main class="@container/main flex flex-1 flex-col gap-4 md:gap-8">
      <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-5">
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>Total Tickets</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <NumberFlow :value="summary?.totalTickets ?? 0" />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>SLA Compliance (30d)</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              <template v-if="summary?.slaCompliance.rate !== null">
                <NumberFlow :value="summary?.slaCompliance.rate ?? 0" suffix="%" />
              </template>
              <template v-else>
                —
              </template>
            </CardTitle>
          </CardHeader>
          <CardFooter class="text-sm text-muted-foreground">
            {{ summary?.slaCompliance.compliant ?? 0 }} of {{ (summary?.slaCompliance.compliant ?? 0) + (summary?.slaCompliance.breached ?? 0) }} resolved on time
          </CardFooter>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>Avg First Response</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {{ formatMins(summary?.avgFirstResponseMins ?? null) }}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card class="@container/card">
          <CardHeader>
            <CardDescription>Avg Resolution Time</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
              {{ formatMins(summary?.avgResolutionMins ?? null) }}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card class="@container/card border-destructive/30">
          <CardHeader>
            <CardDescription>Overdue Right Now</CardDescription>
            <CardTitle class="text-2xl font-semibold tabular-nums text-destructive @[250px]/card:text-3xl">
              <NumberFlow :value="summary?.slaCompliance.openOverdue ?? 0" />
            </CardTitle>
          </CardHeader>
          <CardFooter class="text-sm text-muted-foreground">
            {{ summary?.slaCompliance.breached ?? 0 }} resolved late in the last 30 days
          </CardFooter>
        </Card>
      </div>

      <Card class="@container/card">
        <CardHeader>
          <CardTitle>Ticket Volume</CardTitle>
          <CardDescription>Created vs. resolved, last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <AreaChart :data="summary?.volume ?? []" :categories="['created', 'resolved']" index="date" />
        </CardContent>
      </Card>

      <Card class="@container/card">
        <CardHeader>
          <CardTitle>Customer satisfaction</CardTitle>
          <CardDescription>Survey sent when a ticket is resolved · last 30 days</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-6 md:grid-cols-[220px_1fr]">
          <div>
            <div class="text-5xl font-black tracking-[-0.04em] text-foreground">
              {{ satisfaction?.average ?? '—' }}<span class="text-xl font-bold text-muted-foreground"> / 5</span>
            </div>
            <p class="m-0 mt-1 text-sm text-muted-foreground">
              {{ satisfaction?.responses ?? 0 }} of {{ satisfaction?.sent ?? 0 }} surveys answered
            </p>
            <BarChart v-if="satisfaction?.responses" class="mt-4 h-32" :data="satisfaction.distribution" :categories="['count']" index="score" />
          </div>
          <div class="flex flex-col gap-2">
            <p v-if="!satisfaction?.recentComments.length" class="m-0 text-sm text-muted-foreground">
              No written feedback yet. Tick "Send a satisfaction survey" when you resolve a case.
            </p>
            <NuxtLink v-for="item in satisfaction?.recentComments ?? []" :key="item.ticketId + item.at" :to="`/tickets/${item.ticketId}`" class="rounded-2xl bg-muted/50 p-3 text-sm hover:bg-muted">
              <span class="font-bold" :class="item.rating <= 2 ? 'text-destructive' : 'text-foreground'">{{ item.rating }}/5</span> · {{ item.subject }}
              <span class="mt-1 block text-muted-foreground">"{{ item.comment }}"</span>
            </NuxtLink>
          </div>
        </CardContent>
      </Card>

      <Card class="@container/card">
        <CardHeader>
          <CardTitle>Delayed SLA Responses</CardTitle>
          <CardDescription>Tickets resolved after their SLA deadline, last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <BarChart
            :data="summary?.slaBreachVolume ?? []"
            :categories="['breached']"
            index="date"
            :colors="['#dc2626']"
          />
        </CardContent>
      </Card>

      <div class="grid grid-cols-1 gap-4 @2xl/main:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>By Status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart :data="statusData" category="count" index="status" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart :data="priorityData" :categories="['count']" index="priority" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Agent Performance</CardTitle>
          <CardDescription>Resolved tickets and average resolution time by assignee</CardDescription>
        </CardHeader>
        <CardContent class="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Resolved</TableHead>
                <TableHead>Avg. Resolution Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="summary?.agents.length">
                <TableRow v-for="agent in summary.agents" :key="agent.assigneeId">
                  <TableCell class="font-medium">
                    {{ agent.name }}
                  </TableCell>
                  <TableCell>{{ agent.resolvedCount }}</TableCell>
                  <TableCell>{{ formatMins(agent.avgResolutionMins) }}</TableCell>
                </TableRow>
              </template>
              <TableRow v-else>
                <TableCell :colspan="3" class="h-24 text-center text-muted-foreground">
                  No resolved tickets yet.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </main>
  </div>
</template>
