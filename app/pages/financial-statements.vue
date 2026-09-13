<script setup lang="ts">
definePageMeta({
  middleware: 'finance',
})

const { trialBalance, incomeStatement, balanceSheet, fetchTrialBalance, fetchIncomeStatement, fetchBalanceSheet } = useFinancialStatements()

function today() {
  return new Date().toISOString().slice(0, 10)
}

function firstOfMonth() {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10)
}

const trialBalanceAsOf = ref(today())
const balanceSheetAsOf = ref(today())
const incomeFrom = ref(firstOfMonth())
const incomeTo = ref(today())

onMounted(() => {
  fetchTrialBalance(trialBalanceAsOf.value)
  fetchIncomeStatement(incomeFrom.value, incomeTo.value)
  fetchBalanceSheet(balanceSheetAsOf.value)
})

watch(trialBalanceAsOf, value => fetchTrialBalance(value))
watch(balanceSheetAsOf, value => fetchBalanceSheet(value))
watch([incomeFrom, incomeTo], ([from, to]) => fetchIncomeStatement(from, to))

function formatCurrency(amount: number) {
  return amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Financial Statements
      </h2>
      <p class="text-muted-foreground">
        Trial Balance, Income Statement, and Balance Sheet, computed live from the general ledger.
      </p>
    </div>

    <Tabs default-value="trial-balance">
      <TabsList>
        <TabsTrigger value="trial-balance">
          Trial Balance
        </TabsTrigger>
        <TabsTrigger value="income-statement">
          Income Statement
        </TabsTrigger>
        <TabsTrigger value="balance-sheet">
          Balance Sheet
        </TabsTrigger>
      </TabsList>

      <TabsContent value="trial-balance" class="flex flex-col gap-4 mt-4">
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex flex-col gap-1.5">
            <Label for="trial-balance-as-of">As of</Label>
            <Input id="trial-balance-as-of" v-model="trialBalanceAsOf" type="date" class="w-44" />
          </div>
          <Badge v-if="trialBalance" variant="outline" :class="trialBalance.totalDebit === trialBalance.totalCredit ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400' : 'border-destructive/30 bg-destructive/10 text-destructive'">
            {{ trialBalance.totalDebit === trialBalance.totalCredit ? 'Balanced' : 'Out of balance' }}
          </Badge>
        </div>

        <div class="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead class="text-right">
                  Debit
                </TableHead>
                <TableHead class="text-right">
                  Credit
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <template v-if="trialBalance?.lines.length">
                <TableRow v-for="line in trialBalance.lines" :key="line.code">
                  <TableCell class="font-mono text-xs font-medium">
                    {{ line.code }}
                  </TableCell>
                  <TableCell class="font-medium">
                    {{ line.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ line.side === 'debit' ? formatCurrency(line.amount) : '' }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ line.side === 'credit' ? formatCurrency(line.amount) : '' }}
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-else>
                <TableCell :colspan="4" class="h-24 text-center">
                  No posted activity as of this date.
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter v-if="trialBalance?.lines.length">
              <TableRow>
                <TableCell colspan="2" class="font-semibold">
                  Total
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums">
                  {{ formatCurrency(trialBalance.totalDebit) }}
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums">
                  {{ formatCurrency(trialBalance.totalCredit) }}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="income-statement" class="flex flex-col gap-4 mt-4">
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex flex-col gap-1.5">
            <Label for="income-from">From</Label>
            <Input id="income-from" v-model="incomeFrom" type="date" class="w-44" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label for="income-to">To</Label>
            <Input id="income-to" v-model="incomeTo" type="date" class="w-44" />
          </div>
        </div>

        <div class="border rounded-md">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell colspan="2" class="bg-muted/50 font-semibold">
                  Revenue
                </TableCell>
              </TableRow>
              <template v-if="incomeStatement?.revenue.length">
                <TableRow v-for="line in incomeStatement.revenue" :key="line.code">
                  <TableCell class="pl-8">
                    {{ line.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ formatCurrency(line.amount) }}
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-else>
                <TableCell colspan="2" class="pl-8 text-muted-foreground">
                  No revenue posted in this range.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell class="font-medium">
                  Total Revenue
                </TableCell>
                <TableCell class="text-right font-medium tabular-nums">
                  {{ formatCurrency(incomeStatement?.totalRevenue ?? 0) }}
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell colspan="2" class="bg-muted/50 font-semibold">
                  Expense
                </TableCell>
              </TableRow>
              <template v-if="incomeStatement?.expense.length">
                <TableRow v-for="line in incomeStatement.expense" :key="line.code">
                  <TableCell class="pl-8">
                    {{ line.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ formatCurrency(line.amount) }}
                  </TableCell>
                </TableRow>
              </template>
              <TableRow v-else>
                <TableCell colspan="2" class="pl-8 text-muted-foreground">
                  No expense posted in this range.
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell class="font-medium">
                  Total Expense
                </TableCell>
                <TableCell class="text-right font-medium tabular-nums">
                  {{ formatCurrency(incomeStatement?.totalExpense ?? 0) }}
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell class="font-semibold">
                  Net Income
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums" :class="(incomeStatement?.netIncome ?? 0) < 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'">
                  {{ formatCurrency(incomeStatement?.netIncome ?? 0) }}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="balance-sheet" class="flex flex-col gap-4 mt-4">
        <div class="flex flex-wrap items-end gap-2">
          <div class="flex flex-col gap-1.5">
            <Label for="balance-sheet-as-of">As of</Label>
            <Input id="balance-sheet-as-of" v-model="balanceSheetAsOf" type="date" class="w-44" />
          </div>
          <Badge v-if="balanceSheet" variant="outline" :class="balanceSheet.balanced ? 'border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-400' : 'border-destructive/30 bg-destructive/10 text-destructive'">
            {{ balanceSheet.balanced ? 'Balanced' : 'Out of balance' }}
          </Badge>
        </div>

        <div class="border rounded-md">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell colspan="2" class="bg-muted/50 font-semibold">
                  Assets
                </TableCell>
              </TableRow>
              <template v-if="balanceSheet?.assets.length">
                <TableRow v-for="line in balanceSheet.assets" :key="line.code">
                  <TableCell class="pl-8">
                    {{ line.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ formatCurrency(line.amount) }}
                  </TableCell>
                </TableRow>
              </template>
              <TableRow>
                <TableCell class="font-medium">
                  Total Assets
                </TableCell>
                <TableCell class="text-right font-medium tabular-nums">
                  {{ formatCurrency(balanceSheet?.totalAssets ?? 0) }}
                </TableCell>
              </TableRow>

              <TableRow>
                <TableCell colspan="2" class="bg-muted/50 font-semibold">
                  Liabilities
                </TableCell>
              </TableRow>
              <template v-if="balanceSheet?.liabilities.length">
                <TableRow v-for="line in balanceSheet.liabilities" :key="line.code">
                  <TableCell class="pl-8">
                    {{ line.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ formatCurrency(line.amount) }}
                  </TableCell>
                </TableRow>
              </template>

              <TableRow>
                <TableCell colspan="2" class="bg-muted/50 font-semibold">
                  Equity
                </TableCell>
              </TableRow>
              <template v-if="balanceSheet?.equity.length">
                <TableRow v-for="line in balanceSheet.equity" :key="line.code">
                  <TableCell class="pl-8">
                    {{ line.name }}
                  </TableCell>
                  <TableCell class="text-right tabular-nums">
                    {{ formatCurrency(line.amount) }}
                  </TableCell>
                </TableRow>
              </template>
              <TableRow>
                <TableCell class="pl-8">
                  Net Income (current)
                </TableCell>
                <TableCell class="text-right tabular-nums">
                  {{ formatCurrency(balanceSheet?.netIncome ?? 0) }}
                </TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell class="font-semibold">
                  Total Liabilities &amp; Equity
                </TableCell>
                <TableCell class="text-right font-semibold tabular-nums">
                  {{ formatCurrency(balanceSheet?.totalLiabilitiesAndEquity ?? 0) }}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
