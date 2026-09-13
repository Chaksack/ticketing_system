<script setup lang="ts">
import type { UtilizationStatus } from '~/types/resource-utilization'

definePageMeta({
  middleware: 'capacity',
})

const { rows, from, to, fetchUtilization } = useResourceUtilization()

const fromDraft = ref('')
const toDraft = ref('')

onMounted(async () => {
  await fetchUtilization()
  fromDraft.value = from.value
  toDraft.value = to.value
})

async function onApplyRange() {
  await fetchUtilization({ from: fromDraft.value, to: toDraft.value })
}

const STATUS_BADGE_CLASS: Record<UtilizationStatus, string> = {
  under: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  balanced: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  over: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
}

const STATUS_LABEL: Record<UtilizationStatus, string> = {
  under: 'Under capacity',
  balanced: 'Balanced',
  over: 'Over capacity',
}

const STATUS_BAR_CLASS: Record<UtilizationStatus, string> = {
  under: 'bg-amber-500',
  balanced: 'bg-emerald-500',
  over: 'bg-red-500',
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Resource Utilization
      </h2>
      <p class="text-muted-foreground">
        Logged hours against a weekly capacity estimate — who's stretched thin, who has room.
      </p>
    </div>

    <div class="flex flex-wrap items-end gap-2">
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">From</Label>
        <Input v-model="fromDraft" type="date" class="h-8 w-40 text-xs" />
      </div>
      <div class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">To</Label>
        <Input v-model="toDraft" type="date" class="h-8 w-40 text-xs" />
      </div>
      <Button size="sm" variant="outline" @click="onApplyRange">
        Apply
      </Button>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff</TableHead>
            <TableHead class="text-right">
              Hours Logged
            </TableHead>
            <TableHead class="text-right">
              Capacity
            </TableHead>
            <TableHead>Utilization</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="rows.length">
            <TableRow v-for="row in rows" :key="row.staffId">
              <TableCell class="font-medium">
                {{ row.staffName }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ row.hoursLogged.toFixed(1) }}
              </TableCell>
              <TableCell class="text-right tabular-nums text-muted-foreground">
                {{ row.capacityHours.toFixed(1) }}
              </TableCell>
              <TableCell class="w-48">
                <div class="flex items-center gap-2">
                  <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div class="h-full rounded-full" :class="STATUS_BAR_CLASS[row.status]" :style="{ width: `${Math.min(row.utilizationPct, 100)}%` }" />
                  </div>
                  <span class="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{{ row.utilizationPct.toFixed(0) }}%</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" :class="STATUS_BADGE_CLASS[row.status]">
                  {{ STATUS_LABEL[row.status] }}
                </Badge>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No active staff to report on.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
