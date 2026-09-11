<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({
  middleware: 'admin',
})

const { staff, fetchStaff } = useStaff()
const { quotas, fetchQuotas, upsertQuota, removeQuota } = useBdQuotas()

const bdStaff = computed(() => staff.value.filter(s => s.status === 'active' && s.roles.some(r => r === 'bd' || r === 'sm')))

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

const period = ref(currentPeriod())

async function reload() {
  await fetchQuotas(period.value)
}

onMounted(async () => {
  await fetchStaff()
  await reload()
})

watch(period, reload)

const drafts = reactive<Record<string, string>>({})

watch(quotas, (list) => {
  for (const quota of list)
    drafts[quota.staffId] = String(quota.targetValue)
}, { immediate: true })

function quotaFor(staffId: string) {
  return quotas.value.find(q => q.staffId === staffId)
}

async function save(staffId: string) {
  const value = Number(drafts[staffId])
  if (!drafts[staffId]?.trim() || Number.isNaN(value) || value < 0) {
    toast.error('Enter a valid, non-negative target')
    return
  }

  try {
    await upsertQuota({ staffId, period: period.value, targetValue: value })
    toast('Quota saved')
  }
  catch (error: any) {
    toast.error('Could not save quota', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

async function clear(staffId: string) {
  const quota = quotaFor(staffId)
  if (!quota)
    return
  await removeQuota(quota.id)
  drafts[staffId] = ''
  toast('Quota cleared')
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          BD Quotas
        </h2>
        <p class="text-muted-foreground">
          Monthly weighted-value targets per rep, tracked against won leads and tenders.
        </p>
      </div>

      <Input v-model="period" type="month" class="w-40" />
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rep</TableHead>
            <TableHead>Target</TableHead>
            <TableHead class="w-40" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="bdStaff.length">
            <TableRow v-for="member in bdStaff" :key="member.id">
              <TableCell class="font-medium">
                {{ member.name }}
              </TableCell>
              <TableCell>
                <Input v-model="drafts[member.id]" type="number" min="0" class="w-32 h-8" placeholder="No target set" />
              </TableCell>
              <TableCell>
                <div class="flex gap-1">
                  <Button size="sm" variant="outline" @click="save(member.id)">
                    Save
                  </Button>
                  <Button v-if="quotaFor(member.id)" size="sm" variant="ghost" class="text-destructive" @click="clear(member.id)">
                    Clear
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="3" class="h-24 text-center">
              No active BD/SM staff.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
