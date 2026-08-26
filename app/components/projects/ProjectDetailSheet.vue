<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { AmcContractStatus } from '~/types/amc'
import type { Project, ProjectStatus } from '~/types/project'
import { toast } from 'vue-sonner'
import AmcContractCard from './AmcContractCard.vue'
import { projectStatuses } from './data'

const props = defineProps<{
  project: Project | null
}>()

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const { updateProject, removeProject, assignAmc } = useProjects()
const { plans, fetchPlans } = useAmcPlans()

const newContractStatuses: { value: AmcContractStatus, label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'active', label: 'Active' },
]

onMounted(() => {
  if (!plans.value.length)
    fetchPlans()
})

const status = computed(() => projectStatuses.find(s => s.value === props.project?.status))

async function onStatusChange(value: AcceptableValue) {
  if (!props.project || value === null)
    return

  await updateProject(props.project.id, { status: value as ProjectStatus })
  toast('Status updated', {
    description: `${props.project.name} is now ${projectStatuses.find(s => s.value === value)?.label}.`,
  })
}

const nameDraft = ref('')
const descriptionDraft = ref('')
const startDateDraft = ref('')
const endDateDraft = ref('')

watch(() => props.project?.id, () => {
  nameDraft.value = props.project?.name ?? ''
  descriptionDraft.value = props.project?.description ?? ''
  startDateDraft.value = props.project?.startDate?.slice(0, 10) ?? ''
  endDateDraft.value = props.project?.endDate?.slice(0, 10) ?? ''
}, { immediate: true })

async function saveDetails() {
  if (!props.project || !nameDraft.value.trim())
    return

  await updateProject(props.project.id, {
    name: nameDraft.value.trim(),
    description: descriptionDraft.value.trim() || null,
    startDate: startDateDraft.value || null,
    endDate: endDateDraft.value || null,
  })
  toast('Details saved')
}

const isAssignAmcOpen = ref(false)
const newContract = reactive({ planId: '', startDate: '', endDate: '', status: 'submitted' as AmcContractStatus })

function resetContractForm() {
  newContract.planId = ''
  newContract.status = 'submitted'
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
  if (!props.project || !newContract.planId || !newContract.startDate || !newContract.endDate)
    return

  try {
    await assignAmc(props.project.id, { ...newContract })
    isAssignAmcOpen.value = false
    toast('AMC plan assigned', {
      description: `Assigned to ${props.project.name}.`,
    })
  }
  catch (error: any) {
    toast.error('Could not assign plan', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

const isDeleting = ref(false)

async function onDelete() {
  if (!props.project)
    return

  isDeleting.value = true
  try {
    const name = props.project.name
    await removeProject(props.project.id)
    open.value = false
    emit('deleted')
    toast('Project deleted', { description: `${name} was removed.` })
  }
  finally {
    isDeleting.value = false
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-lg p-0">
      <template v-if="project">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ project.id }}
          </SheetDescription>
          <SheetTitle>{{ project.name }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Select :model-value="project.status" @update:model-value="onStatusChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <component :is="status?.icon" v-if="status?.icon" class="h-3.5 w-3.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in projectStatuses" :key="s.value" :value="s.value">
                  <span class="flex items-center gap-2">
                    <component :is="s.icon" v-if="s.icon" class="h-3.5 w-3.5" />
                    {{ s.label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <NuxtLink v-if="project.clientName" :to="`/clients?open=${project.clientId}`" class="text-xs text-muted-foreground hover:underline">
              {{ project.clientName }}
            </NuxtLink>
          </div>
        </SheetHeader>

        <ScrollArea class="flex-1 min-h-0">
          <div class="flex flex-col gap-6 px-6 pt-4 pb-6">
            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Details
              </h4>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Project Name</Label>
                <Input v-model="nameDraft" placeholder="Project name" />
              </div>
              <div class="flex flex-col gap-1.5">
                <Label class="text-xs text-muted-foreground">Description</Label>
                <Textarea v-model="descriptionDraft" rows="3" placeholder="What's this project about..." />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">Start Date</Label>
                  <Input v-model="startDateDraft" type="date" />
                </div>
                <div class="flex flex-col gap-1.5">
                  <Label class="text-xs text-muted-foreground">End Date</Label>
                  <Input v-model="endDateDraft" type="date" />
                </div>
              </div>
              <div class="flex justify-end">
                <Button size="sm" variant="outline" :disabled="!nameDraft.trim()" @click="saveDetails">
                  Save Details
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
                    <div class="flex flex-col gap-1.5">
                      <Label class="text-xs">Status</Label>
                      <Select v-model="newContract.status">
                        <SelectTrigger class="w-full h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem v-for="s in newContractStatuses" :key="s.value" :value="s.value">
                            {{ s.label }}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button size="sm" :disabled="!newContract.planId" @click="onAssignAmc">
                      Assign
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>

              <p v-if="!project.contracts.length" class="text-sm text-muted-foreground">
                No AMC contracts yet.
              </p>

              <AmcContractCard v-for="contract in project.contracts" :key="contract.id" :contract="contract" />
            </div>

            <Separator />

            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button variant="destructive">
                  <Icon name="i-lucide-trash-2" class="mr-2 h-4 w-4" />
                  Delete Project
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {{ project.name }}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Its AMC contracts will be kept but unlinked from this project. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction :disabled="isDeleting" @click="onDelete">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
