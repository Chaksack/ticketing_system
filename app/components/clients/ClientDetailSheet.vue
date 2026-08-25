<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { AmcContractDisplayStatus } from '~/types/amc'
import type { Client, ClientActivity, ClientStage } from '~/types/client'
import { toast } from 'vue-sonner'
import { stages } from './data'

const props = defineProps<{
  client: Client | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { updateClient, assignAmc } = useClients()
const { cancelContract } = useAmcContracts()
const { staff, fetchStaff } = useStaff()
const { plans, fetchPlans } = useAmcPlans()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
  if (!plans.value.length)
    fetchPlans()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const stage = computed(() => stages.find(s => s.value === props.client?.stage))

async function onStageChange(value: AcceptableValue) {
  if (!props.client || value === null)
    return

  await updateClient(props.client.id, { stage: value as ClientStage })
  toast('Stage updated', {
    description: `${props.client.name} is now ${stages.find(s => s.value === value)?.label}.`,
  })
}

async function onAssigneeChange(value: AcceptableValue) {
  if (!props.client)
    return

  const assignedTo = value === 'unassigned' ? null : value as string
  await updateClient(props.client.id, { assignedTo })

  const name = staff.value.find(s => s.id === assignedTo)?.name
  toast('Assignee updated', {
    description: name ? `Assigned to ${name}.` : 'Client unassigned.',
  })
}

const notesDraft = ref('')
watch(() => props.client?.id, () => {
  notesDraft.value = props.client?.notes ?? ''
}, { immediate: true })

async function saveNotes() {
  if (!props.client)
    return

  await updateClient(props.client.id, { notes: notesDraft.value })
  toast('Notes saved')
}

const isAssignAmcOpen = ref(false)
const newContract = reactive({ planId: '', startDate: '', endDate: '' })

function resetContractForm() {
  newContract.planId = ''
  const today = new Date()
  newContract.startDate = today.toISOString().slice(0, 10)
  const end = new Date(today)
  end.setMonth(end.getMonth() + 12)
  newContract.endDate = end.toISOString().slice(0, 10)
}

watch(isAssignAmcOpen, (isOpen) => {
  if (isOpen)
    resetContractForm()
})

watch(() => newContract.planId, (planId) => {
  const plan = plans.value.find(p => p.id === planId)
  if (!plan || !newContract.startDate)
    return
  const end = new Date(newContract.startDate)
  end.setMonth(end.getMonth() + plan.defaultDurationMonths)
  newContract.endDate = end.toISOString().slice(0, 10)
})

async function onAssignAmc() {
  if (!props.client || !newContract.planId || !newContract.startDate || !newContract.endDate)
    return

  try {
    await assignAmc(props.client.id, { ...newContract })
    isAssignAmcOpen.value = false
    toast('AMC plan assigned', {
      description: `Assigned to ${props.client.name}.`,
    })
  }
  catch (error: any) {
    toast('Could not assign plan', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

async function onCancelContract(contractId: string) {
  await cancelContract(contractId)
  toast('Contract cancelled')
}

const CONTRACT_STATUS_VARIANT: Record<AmcContractDisplayStatus, 'secondary' | 'outline' | 'destructive'> = {
  active: 'secondary',
  expiring: 'outline',
  expired: 'destructive',
  cancelled: 'outline',
}

const CONTRACT_STATUS_LABEL: Record<AmcContractDisplayStatus, string> = {
  active: 'Active',
  expiring: 'Expiring soon',
  expired: 'Expired',
  cancelled: 'Cancelled',
}

function activityLabel(activity: ClientActivity) {
  const actor = activity.actorName ?? 'Someone'

  switch (activity.type) {
    case 'stage_changed':
      return `${actor} moved this client from ${activity.fromValue} to ${activity.toValue}`
    case 'assignee_changed':
      return `${actor} assigned to ${activity.toValue}`
    case 'note_updated':
      return `${actor} updated the notes`
    case 'amc_cancelled':
      return `${actor} cancelled an AMC contract`
    default:
      return activity.message ?? `${actor} updated this client`
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-lg p-0">
      <template v-if="client">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ client.id }}
          </SheetDescription>
          <SheetTitle>{{ client.name }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Select :model-value="client.stage" @update:model-value="onStageChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <component :is="stage?.icon" v-if="stage?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in stages" :key="s.value" :value="s.value">
                  <span class="flex items-center gap-2">
                    <component :is="s.icon" v-if="s.icon" class="h-3.5 w-3.5" />
                    {{ s.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-wrap items-center gap-2 pt-2">
            <span class="text-xs text-muted-foreground">Assigned to</span>
            <Select :model-value="client.assignedTo ?? 'unassigned'" @update:model-value="onAssigneeChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  Unassigned
                </SelectItem>
                <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
                  {{ member.name }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="text-sm text-muted-foreground pt-1 flex flex-col gap-0.5">
            <span v-if="client.contactName">{{ client.contactName }}</span>
            <span v-if="client.contactEmail">{{ client.contactEmail }}</span>
            <span v-if="client.contactPhone">{{ client.contactPhone }}</span>
          </div>
        </SheetHeader>

        <ScrollArea class="h-[calc(100vh-2px)]">
          <div class="flex flex-col gap-6 px-6 pt-4">
            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Notes
              </h4>
              <Textarea v-model="notesDraft" rows="3" placeholder="Notes about this client..." />
              <div class="flex justify-end">
                <Button size="sm" variant="outline" @click="saveNotes">
                  Save Notes
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-medium">
                  AMC Contracts
                </h4>
                <Popover v-model:open="isAssignAmcOpen">
                  <PopoverTrigger as-child>
                    <Button size="sm" variant="outline" class="gap-1.5">
                      <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
                      Assign AMC
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent class="w-[280px] flex flex-col gap-3" align="end">
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs">Plan</Label>
                      <Select v-model="newContract.planId">
                        <SelectTrigger class="w-full h-8 text-xs">
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="plan in plans" :key="plan.id" :value="plan.id">
                            {{ plan.name }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs">Start date</Label>
                      <Input v-model="newContract.startDate" type="date" class="h-8 text-xs" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs">End date</Label>
                      <Input v-model="newContract.endDate" type="date" class="h-8 text-xs" />
                    </div>
                    <Button size="sm" :disabled="!newContract.planId" @click="onAssignAmc">
                      Assign
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>

              <p v-if="!client.contracts.length" class="text-sm text-muted-foreground">
                No AMC contracts yet.
              </p>

              <div v-for="contract in client.contracts" :key="contract.id" class="flex flex-col gap-1 rounded-md border p-3">
                <div class="flex items-center justify-between">
                  <span class="text-sm font-medium">{{ contract.planName }}</span>
                  <Badge :variant="CONTRACT_STATUS_VARIANT[getContractDisplayStatus(contract)]">
                    {{ CONTRACT_STATUS_LABEL[getContractDisplayStatus(contract)] }}
                  </Badge>
                </div>
                <p class="text-xs text-muted-foreground">
                  {{ formatDate(contract.startDate) }} – {{ formatDate(contract.endDate) }}
                </p>
                <div v-if="contract.status === 'active'" class="flex justify-end">
                  <Button size="sm" variant="ghost" class="text-destructive h-7" @click="onCancelContract(contract.id)">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3 pb-6">
              <h4 class="text-sm font-medium">
                Activity
              </h4>
              <p v-if="!client.activity.length" class="text-sm text-muted-foreground">
                No activity yet.
              </p>
              <div v-for="activity in client.activity" :key="activity.id" class="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <span>{{ activityLabel(activity) }}</span>
                <span>·</span>
                <span>{{ formatDateTime(activity.createdAt) }}</span>
              </div>
            </div>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
