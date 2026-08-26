<script setup lang="ts">
import type { AmcContract, AmcContractStatus } from '~/types/amc'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'

const props = defineProps<{
  contract: AmcContract
}>()

const { updateContract, cancelContract } = useAmcContracts()

const contractStatuses: { value: AmcContractStatus, label: string, badgeClass: string }[] = [
  { value: 'submitted', label: 'Submitted', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30' },
  { value: 'negotiating', label: 'Negotiating', badgeClass: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30' },
  { value: 'active', label: 'Active', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' },
  { value: 'lost', label: 'Lost', badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30' },
  { value: 'cancelled', label: 'Cancelled', badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30' },
  { value: 'expired', label: 'Expired', badgeClass: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30' },
]

const displayBadgeClass: Record<string, string> = {
  submitted: contractStatuses[0]!.badgeClass,
  negotiating: contractStatuses[1]!.badgeClass,
  active: contractStatuses[2]!.badgeClass,
  expiring: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  lost: contractStatuses[3]!.badgeClass,
  cancelled: contractStatuses[4]!.badgeClass,
  expired: contractStatuses[5]!.badgeClass,
}

const displayLabel: Record<string, string> = {
  submitted: 'Submitted',
  negotiating: 'Negotiating',
  active: 'Active',
  expiring: 'Expiring soon',
  lost: 'Lost',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

async function onStatusChange(value: unknown) {
  if (value === null || value === props.contract.status)
    return
  await updateContract(props.contract.id, { status: value as AmcContractStatus })
  toast('AMC status updated')
}

const df = new DateFormatter('en-US', { dateStyle: 'medium' })
const nextStepDraft = ref(props.contract.nextStep ?? '')
const reminderField = useDateTimeField()
reminderField.setFromIso(props.contract.nextStepAt)

async function saveFollowUp() {
  await updateContract(props.contract.id, {
    nextStep: nextStepDraft.value || null,
    nextStepAt: reminderField.toIso() ?? null,
  })
  toast('Follow-up saved', {
    description: reminderField.toIso() ? 'A reminder will notify the client\'s assignees when it\'s due.' : undefined,
  })
}

async function onCancel() {
  await cancelContract(props.contract.id)
  toast('Contract cancelled')
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="flex flex-col gap-2 rounded-md border p-3">
    <div class="flex items-center justify-between">
      <span class="text-sm font-medium">{{ contract.planName }}</span>
      <Select :model-value="contract.status" @update:model-value="onStatusChange">
        <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
          <Badge variant="outline" class="border-0 p-0" :class="displayBadgeClass[getContractDisplayStatus(contract)]">
            {{ displayLabel[getContractDisplayStatus(contract)] }}
          </Badge>
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="option in contractStatuses" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
    <p class="text-xs text-muted-foreground">
      {{ formatDate(contract.startDate) }} – {{ formatDate(contract.endDate) }}
    </p>

    <div class="flex flex-col gap-1.5 pt-1">
      <Label class="text-xs text-muted-foreground">Follow-up / Next Step</Label>
      <Textarea v-model="nextStepDraft" rows="2" placeholder="What's the next action on this AMC?" class="text-xs" />
      <div class="flex items-center gap-1">
        <Popover>
          <PopoverTrigger as-child>
            <Button variant="outline" size="sm" :class="cn('flex-1 justify-start text-left font-normal', !reminderField.date.value && 'text-muted-foreground')">
              <Icon name="i-lucide-calendar" class="mr-2 h-3.5 w-3.5" />
              {{ reminderField.date.value ? df.format(reminderField.date.value.toDate(getLocalTimeZone())) : 'Remind me at' }}
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-auto p-0">
            <Calendar v-model="reminderField.date.value" initial-focus />
          </PopoverContent>
        </Popover>
        <Input v-model="reminderField.time.value" type="time" step="60" class="w-24 h-8 text-xs" />
      </div>
      <div class="flex justify-end">
        <Button size="sm" variant="outline" @click="saveFollowUp">
          Save Follow-up
        </Button>
      </div>
    </div>

    <div v-if="contract.status !== 'cancelled'" class="flex justify-end">
      <Button size="sm" variant="ghost" class="text-destructive h-7" @click="onCancel">
        Cancel Contract
      </Button>
    </div>
  </div>
</template>
