<script setup lang="ts">
import NumberFlow from '@number-flow/vue'

definePageMeta({
  middleware: 'admin',
})

const { summary, fetchSummary } = useExecutiveSummary()

onMounted(() => {
  fetchSummary()
})

function currency(amount: number) {
  return amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
</script>

<template>
  <div class="w-full flex flex-col gap-6">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Executive Dashboard
      </h2>
      <p class="text-muted-foreground">
        Support, Sales, Finance, and Projects — one view across everything.
      </p>
    </div>

    <main class="@container/main flex flex-1 flex-col gap-8">
      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          Support
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Open Tickets</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.support.openTickets ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card" :class="summary && summary.support.overdueTickets > 0 ? 'border-destructive/30' : ''">
            <CardHeader>
              <CardDescription>Overdue Tickets</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl" :class="summary && summary.support.overdueTickets > 0 ? 'text-destructive' : ''">
                <NumberFlow :value="summary?.support.overdueTickets ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          Sales
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Pipeline Value</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {{ currency(summary?.sales.pipelineValue ?? 0) }}
              </CardTitle>
            </CardHeader>
            <CardFooter class="text-sm text-muted-foreground">
              Weighted: {{ currency(summary?.sales.weightedPipelineValue ?? 0) }}
            </CardFooter>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Win Rate</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <template v-if="summary?.sales.winRate !== null">
                  <NumberFlow :value="summary?.sales.winRate ?? 0" suffix="%" />
                </template>
                <template v-else>
                  —
                </template>
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Open Quotes Value</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {{ currency(summary?.sales.openQuotesValue ?? 0) }}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          Finance
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Cash</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {{ currency(summary?.finance.cash ?? 0) }}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Accounts Receivable</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {{ currency(summary?.finance.accountsReceivable ?? 0) }}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Accounts Payable</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {{ currency(summary?.finance.accountsPayable ?? 0) }}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Net Income (MTD)</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl" :class="(summary?.finance.netIncome ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'">
                {{ currency(summary?.finance.netIncome ?? 0) }}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      </section>

      <section class="flex flex-col gap-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          Projects
        </h3>
        <div class="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Active Projects</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                <NumberFlow :value="summary?.projects.activeProjects ?? 0" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card class="@container/card">
            <CardHeader>
              <CardDescription>Total Margin</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl" :class="(summary?.projects.totalMargin ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'">
                {{ currency(summary?.projects.totalMargin ?? 0) }}
              </CardTitle>
            </CardHeader>
            <CardFooter class="text-sm text-muted-foreground">
              Revenue {{ currency(summary?.projects.totalRevenue ?? 0) }} · Cost {{ currency(summary?.projects.totalCost ?? 0) }}
            </CardFooter>
          </Card>
          <Card class="@container/card" :class="summary && summary.projects.staffOverCapacity > 0 ? 'border-amber-500/30' : ''">
            <CardHeader>
              <CardDescription>Staff Over Capacity</CardDescription>
              <CardTitle class="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl" :class="summary && summary.projects.staffOverCapacity > 0 ? 'text-amber-600 dark:text-amber-400' : ''">
                <NumberFlow :value="summary?.projects.staffOverCapacity ?? 0" />
              </CardTitle>
            </CardHeader>
            <CardFooter class="text-sm text-muted-foreground">
              This week
            </CardFooter>
          </Card>
        </div>
      </section>
    </main>
  </div>
</template>
