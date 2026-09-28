<script setup lang="ts">
import type { BdQuotaPeriodType } from '~/types/quota'
import { toast } from 'vue-sonner'
import { parseAmountInput } from '~/lib/formNumbers'

definePageMeta({
  middleware: 'admin',
})

const { staff, fetchStaff } = useStaff()
const { quotas, fetchQuotas, upsertQuota, removeQuota } = useBdQuotas()

const bdStaff = computed(() => staff.value.filter(s => s.status === 'active' && s.roles.some(r => r === 'bd' || r === 'sm')))

const now = new Date()
const periodType = ref<BdQuotaPeriodType>('month')
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
const year = ref(String(now.getFullYear()))
const yearOptions = Array.from({ length: 5 }, (_, i) => String(now.getFullYear() - 1 + i))

// A monthly quota is stored under "2026-09", a yearly one under "2026" — a rep can have both.
const period = computed(() => periodType.value === 'year' ? year.value : month.value)
const periodLabel = computed(() => periodType.value === 'year'
  ? year.value
  : new Date(`${month.value}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))

async function reload() {
  await fetchQuotas(period.value)
}

onMounted(async () => {
  await fetchStaff()
  await reload()
})

watch(period, reload)

// `<Input type="number">` hands back a number (or '' when blank), so drafts hold either.
const drafts = reactive<Record<string, string | number>>({})

watch(quotas, (list) => {
  for (const key of Object.keys(drafts))
    delete drafts[key]
  for (const quota of list)
    drafts[quota.staffId] = quota.targetValue
}, { immediate: true })

function quotaFor(staffId: string) {
  return quotas.value.find(q => q.staffId === staffId)
}

async function save(staffId: string) {
  const value = parseAmountInput(drafts[staffId])
  if (value === undefined || value < 0) {
    toast.error('Enter a valid, non-negative target')
    return
  }

  try {
    await upsertQuota({ staffId, period: period.value, targetValue: value })
    toast('Quota saved', { description: `${periodType.value === 'year' ? 'Yearly' : 'Monthly'} target for ${periodLabel.value}.` })
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
          Monthly or yearly won-value targets per rep, tracked against won leads and tenders.
        </p>
      </div>

      <div class="flex items-center gap-2">
        <Tabs v-model="periodType">
          <TabsList>
            <TabsTrigger value="month">
              Monthly
            </TabsTrigger>
            <TabsTrigger value="year">
              Yearly
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Input v-if="periodType === 'month'" v-model="month" type="month" class="w-40" />
        <Select v-else v-model="year">
          <SelectTrigger class="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in yearOptions" :key="option" :value="option">
              {{ option }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <p class="text-sm text-muted-foreground -mt-2">
      Setting {{ periodType === 'year' ? 'yearly' : 'monthly' }} targets for <span class="font-medium text-foreground">{{ periodLabel }}</span>.
      Monthly and yearly targets are separate. Setting one doesn't change the other.
    </p>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rep</TableHead>
            <TableHead>{{ periodType === 'year' ? 'Yearly' : 'Monthly' }} Target</TableHead>
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
