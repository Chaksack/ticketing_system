<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { AmcContractStatus } from '~/types/amc'
import type { Project, ProjectStatus } from '~/types/project'
import type { Task } from '~/types/task'
import { toast } from 'vue-sonner'
import { priorities } from '~/components/tasks/data'
import { getTaskDueStatus } from '~/lib/tasks'
import { PROJECT_STATUS_PROGRESS } from '~/types/project'
import TaskFormSheet from '../tasks/TaskFormSheet.vue'
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
const { fetchTasksForProject } = useTasks()
const { statuses: taskStatuses, fetchStatuses: fetchTaskStatuses } = useTaskStatuses()

const newContractStatuses: { value: AmcContractStatus, label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'negotiating', label: 'Negotiating' },
  { value: 'active', label: 'Active' },
]

onMounted(() => {
  if (!plans.value.length)
    fetchPlans()
  if (!taskStatuses.value.length)
    fetchTaskStatuses()
})

const status = computed(() => projectStatuses.find(s => s.value === props.project?.status))
const progressPercent = computed(() => props.project ? PROJECT_STATUS_PROGRESS[props.project.status] : 0)

const PROGRESS_BAR_CLASS: Record<ProjectStatus, string> = {
  planned: 'bg-muted-foreground/50',
  active: 'bg-primary',
  on_hold: 'bg-amber-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-destructive',
}
const progressBarClass = computed(() => props.project ? PROGRESS_BAR_CLASS[props.project.status] : 'bg-muted-foreground/50')

const projectTasks = ref<Task[]>([])
const isLoadingTasks = ref(false)

async function loadProjectTasks() {
  if (!props.project)
    return
  isLoadingTasks.value = true
  try {
    projectTasks.value = await fetchTasksForProject(props.project.id)
  }
  finally {
    isLoadingTasks.value = false
  }
}

watch(() => props.project?.id, loadProjectTasks, { immediate: true })

const isTaskFormOpen = ref(false)
const editingTask = ref<Task | null>(null)

function openNewTask() {
  editingTask.value = null
  isTaskFormOpen.value = true
}

function openEditTask(task: Task) {
  editingTask.value = task
  isTaskFormOpen.value = true
}

// The task form writes through the global tasks composable, not this sheet's own local list —
// refetch whenever it closes so a create/edit/status-change is reflected here too.
watch(isTaskFormOpen, (isOpen) => {
  if (!isOpen)
    loadProjectTasks()
})

const DUE_BADGE_CLASS: Record<string, string> = {
  'on-track': 'text-muted-foreground',
  'due-soon': 'text-amber-600 dark:text-amber-400',
  'overdue': 'text-destructive',
}

function taskStatusLabel(task: Task) {
  return taskStatuses.value.find(s => s.id === task.status)?.label ?? task.status
}

function priorityMeta(priority: Task['priority']) {
  return priorities.find(p => p.value === priority)
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('')
}

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
    <SheetContent side="right" class="w-full sm:max-w-2xl p-0">
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
          <div class="flex flex-col gap-1 pt-2">
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div class="h-full rounded-full transition-all" :class="progressBarClass" :style="{ width: `${progressPercent}%` }" />
            </div>
            <p class="text-xs text-muted-foreground">
              {{ progressPercent }}% · {{ status?.label }}
            </p>
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
                  Tasks
                </h4>
                <Button size="sm" variant="outline" class="gap-1.5" @click="openNewTask">
                  <Icon name="i-lucide-plus" class="h-3.5 w-3.5" />
                  Add Task
                </Button>
              </div>

              <p v-if="isLoadingTasks" class="text-sm text-muted-foreground">
                Loading…
              </p>
              <p v-else-if="!projectTasks.length" class="text-sm text-muted-foreground">
                No tasks linked to this project yet.
              </p>
              <button
                v-for="task in projectTasks" :key="task.id" type="button"
                class="flex flex-col gap-1.5 rounded-md border p-2.5 text-left hover:bg-accent/50"
                @click="openEditTask(task)"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-medium">{{ task.title }}</span>
                  <Badge variant="outline" class="shrink-0 text-[10px]">
                    {{ taskStatusLabel(task) }}
                  </Badge>
                </div>
                <div class="flex flex-wrap items-center gap-2">
                  <Badge v-if="priorityMeta(task.priority)" variant="outline" class="gap-1 text-[10px]" :class="priorityMeta(task.priority)?.badgeClass">
                    {{ priorityMeta(task.priority)?.label }}
                  </Badge>
                  <span v-if="task.dueDate" class="flex items-center gap-1 text-xs" :class="DUE_BADGE_CLASS[getTaskDueStatus(task) ?? 'on-track']">
                    <Icon name="i-lucide-calendar" class="size-3" />
                    {{ formatDueDate(task.dueDate) }}
                  </span>
                  <div v-if="task.assignees.length" class="ml-auto flex items-center -space-x-2">
                    <Tooltip v-for="assignee in task.assignees.slice(0, 3)" :key="assignee.id">
                      <TooltipTrigger as-child>
                        <Avatar class="size-6 border-2 border-card">
                          <AvatarFallback class="text-[10px]">
                            {{ initials(assignee.name) }}
                          </AvatarFallback>
                        </Avatar>
                      </TooltipTrigger>
                      <TooltipContent>{{ assignee.name }}</TooltipContent>
                    </Tooltip>
                    <div v-if="task.assignees.length > 3" class="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium">
                      +{{ task.assignees.length - 3 }}
                    </div>
                  </div>
                  <span v-else class="ml-auto text-xs text-muted-foreground">Unassigned</span>
                </div>
              </button>
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

  <TaskFormSheet
    v-model:open="isTaskFormOpen"
    :task="editingTask"
    :project-id="project?.id"
  />
</template>
