<script setup lang="ts">
definePageMeta({
  middleware: 'finance',
})

const { rows, fetchProfitability } = useProjectProfitability()

onMounted(() => {
  fetchProfitability()
})

function formatCurrency(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Project Profitability
      </h2>
      <p class="text-muted-foreground">
        Invoiced revenue against logged-time cost, per project.
      </p>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Project</TableHead>
            <TableHead class="text-right">
              Revenue
            </TableHead>
            <TableHead class="text-right">
              Cost
            </TableHead>
            <TableHead class="text-right">
              Margin
            </TableHead>
            <TableHead class="text-right">
              Margin %
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="rows.length">
            <TableRow v-for="row in rows" :key="row.projectId">
              <TableCell class="font-medium">
                {{ row.projectName }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ formatCurrency(row.revenue) }}
              </TableCell>
              <TableCell class="text-right tabular-nums text-muted-foreground">
                {{ formatCurrency(row.cost) }}
              </TableCell>
              <TableCell class="text-right tabular-nums font-medium" :class="row.margin < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'">
                {{ formatCurrency(row.margin) }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ row.marginPct === null ? '—' : `${row.marginPct.toFixed(1)}%` }}
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No projects yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
