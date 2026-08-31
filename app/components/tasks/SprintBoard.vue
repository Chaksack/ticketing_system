<script setup lang="ts">
import type { Sprint } from '~/types/sprint'
import type { Task } from '~/types/task'
import { toast } from 'vue-sonner'
import Draggable from 'vuedraggable'
import { priorities } from './data'
import SprintFormSheet from './SprintFormSheet.vue'
import TaskFormSheet from './TaskFormSheet.vue'

const { tasks, updateTask, removeTask, subtasksOf } = useTasks()
const { statuses, addStatus, renameStatus, removeStatus, reorderStatuses } = useTaskStatuses()
const { sprints, updateSprint, removeSprint } = useSprints()
const { staff, fetchStaff } = useStaff()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))

const isDesktop = useMediaQuery('(min-width: 768px)')
const [DefineSprintList, ReuseSprintList] = createReusableTemplate()
const showSprintDrawer = ref(false)
const showFilterDrawer = ref(false)

const STATUS_ORDER: Record<Sprint['status'], number> = { active: 0, planned: 1, completed: 2 }
const orderedSprints = computed(() => [...sprints.value].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]))

const BACKLOG = 'backlog'
const selectedView = ref<string>(BACKLOG)
const selectedSprint = computed(() => sprints.value.find(s => s.id === selectedView.value))

function selectView(view: string) {
  selectedView.value = view
  showSprintDrawer.value = false
}

function openNewSprintFromDrawer() {
  showSprintDrawer.value = false
  openNewSprint()
}

function editSprintFromDrawer(sprint: Sprint) {
  showSprintDrawer.value = false
  openEditSprint(sprint)
}

function deleteSprintFromDrawer(sprint: Sprint) {
  showSprintDrawer.value = false
  onDeleteSprint(sprint)
}

const SPRINT_STATUS_BADGE: Record<Sprint['status'], string> = {
  planned: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/15 dark:text-slate-400 dark:border-slate-500/30',
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  completed: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
}

const assigneeFilter = ref('all')
const priorityFilter = ref('all')
const dueFilter = ref('all')

const hasActiveFilters = computed(() =>
  assigneeFilter.value !== 'all' || priorityFilter.value !== 'all' || dueFilter.value !== 'all',
)

const activeToolbarFilterCount = computed(() =>
  [assigneeFilter.value !== 'all', priorityFilter.value !== 'all', dueFilter.value !== 'all'].filter(Boolean).length,
)

function resetFilters() {
  assigneeFilter.value = 'all'
  priorityFilter.value = 'all'
  dueFilter.value = 'all'
}

function matchesFilters(task: Task) {
  if (assigneeFilter.value === 'unassigned') {
    if (task.assignees.length)
      return false
  }
  else if (assigneeFilter.value !== 'all' && !task.assignees.some(a => a.id === assigneeFilter.value)) {
    return false
  }

  if (priorityFilter.value !== 'all' && task.priority !== priorityFilter.value)
    return false

  if (dueFilter.value === 'none') {
    if (task.dueDate)
      return false
  }
  else if (dueFilter.value !== 'all' && getTaskDueStatus(task) !== dueFilter.value) {
    return false
  }

  return true
}

function matchesView(task: Task) {
  return selectedView.value === BACKLOG ? !task.sprintId : task.sprintId === selectedView.value
}

const columnTasks = reactive<Record<string, Task[]>>({})

function syncColumns() {
  const nextIds = new Set(statuses.value.map(s => s.id))
  for (const key of Object.keys(columnTasks)) {
    if (!nextIds.has(key))
      delete columnTasks[key]
  }
  for (const col of statuses.value) {
    columnTasks[col.id] = tasks.value.filter(t => t.type === 'task' && t.status === col.id && matchesView(t) && matchesFilters(t))
  }
}

watch([tasks, selectedView, assigneeFilter, priorityFilter, dueFilter, statuses], syncColumns, { immediate: true, deep: true })

const boardRoot = ref<HTMLElement>()
const { top: boardTop } = useElementBounding(boardRoot)
const { height: windowHeight } = useWindowSize()
const boardHeight = computed(() => `${Math.max(windowHeight.value - boardTop.value - 16, 240)}px`)

async function onChange(statusId: string, evt: any) {
  if (evt.added)
    await updateTask(evt.added.element.id, { status: statusId })
}

const expanded = reactive<Set<string>>(new Set())
function toggleExpanded(taskId: string) {
  if (expanded.has(taskId))
    expanded.delete(taskId)
  else
    expanded.add(taskId)
}

const doneStatusId = computed(() => statuses.value.find(s => s.id === 'done')?.id ?? statuses.value.at(-1)?.id)
const todoStatusId = computed(() => statuses.value.find(s => s.id === 'todo')?.id ?? statuses.value[0]?.id)

async function toggleSubtaskDone(subtask: Task) {
  const nextStatus = subtask.status === doneStatusId.value ? todoStatusId.value : doneStatusId.value
  if (nextStatus)
    await updateTask(subtask.id, { status: nextStatus })
}

const formOpen = ref(false)
const formType = ref<'task' | 'subtask'>('task')
const formTask = ref<Task | null>(null)
const formParentTaskId = ref<string | undefined>()

function openNewTask() {
  formTask.value = null
  formType.value = 'task'
  formParentTaskId.value = undefined
  formOpen.value = true
}

function openNewSubtask(parentTaskId: string) {
  formTask.value = null
  formType.value = 'subtask'
  formParentTaskId.value = parentTaskId
  formOpen.value = true
}

function openEdit(task: Task) {
  formTask.value = task
  formParentTaskId.value = undefined
  formOpen.value = true
}

async function moveToSprint(task: Task, sprintId: string | null) {
  await updateTask(task.id, { sprintId })
}

function priorityMeta(priority: string) {
  return priorities.find(p => p.value === priority)
}

function initials(name?: string) {
  if (!name)
    return '?'
  return name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()
}

function formatDueDate(task: Task) {
  if (!task.dueDate)
    return ''
  return new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatSprintDate(iso?: string) {
  if (!iso)
    return null
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const DUE_BADGE_CLASS: Record<string, string> = {
  'on-track': 'text-muted-foreground',
  'due-soon': 'text-amber-600 dark:text-amber-400',
  'overdue': 'text-destructive',
}

// --- Sprint rail management ---
const sprintFormOpen = ref(false)
const editingSprint = ref<Sprint | null>(null)

function openNewSprint() {
  editingSprint.value = null
  sprintFormOpen.value = true
}

function openEditSprint(sprint: Sprint) {
  editingSprint.value = sprint
  sprintFormOpen.value = true
}

async function onDeleteSprint(sprint: Sprint) {
  await removeSprint(sprint.id)
  if (selectedView.value === sprint.id)
    selectedView.value = BACKLOG
}

async function startSprint(sprint: Sprint) {
  const otherActive = sprints.value.find(s => s.status === 'active' && s.id !== sprint.id)
  await updateSprint(sprint.id, { status: 'active' })
  if (otherActive)
    toast('Sprint started', { description: `${otherActive.name} was automatically completed.` })
  else
    toast('Sprint started', { description: `${sprint.name} is now active.` })
}

async function completeSprint(sprint: Sprint) {
  await updateSprint(sprint.id, { status: 'completed' })
  toast('Sprint completed', { description: `${sprint.name} was marked completed.` })
}

// --- Column management ---
const renamingColumnId = ref<string | null>(null)
const renameValue = ref('')

function startRename(col: { id: string, label: string }) {
  renamingColumnId.value = col.id
  renameValue.value = col.label
}

async function confirmRename() {
  const id = renamingColumnId.value
  if (!id)
    return
  renamingColumnId.value = null
  if (!renameValue.value.trim())
    return
  await renameStatus(id, renameValue.value.trim())
}

async function onDeleteColumn(col: { id: string, label: string }) {
  try {
    await removeStatus(col.id)
  }
  catch (error: any) {
    toast.error('Could not delete column', {
      description: error?.data?.statusMessage ?? 'Move or delete its tasks first.',
    })
  }
}

const addingColumn = ref(false)
const newColumnLabel = ref('')

async function confirmAddColumn() {
  if (!newColumnLabel.value.trim())
    return
  await addStatus(newColumnLabel.value.trim())
  newColumnLabel.value = ''
  addingColumn.value = false
}

async function onColumnsReordered() {
  await reorderStatuses(statuses.value.map(c => c.id))
}
</script>

<template>
  <DefineSprintList>
    <div class="flex items-center justify-between">
      <h3 class="font-semibold text-sm">
        Sprints
      </h3>
      <Button size="sm" variant="ghost" class="h-7 px-2" @click="openNewSprintFromDrawer">
        <Icon name="i-lucide-plus" class="mr-1 h-3.5 w-3.5" />
        New
      </Button>
    </div>

    <button
      type="button"
      class="text-left text-sm rounded-md px-2 py-1.5 hover:bg-accent flex items-center gap-2"
      :class="selectedView === BACKLOG && 'bg-accent font-medium'"
      @click="selectView(BACKLOG)"
    >
      <Icon name="i-lucide-inbox" class="size-3.5 text-muted-foreground shrink-0" />
      Backlog
    </button>

    <div class="flex-1 min-h-0 flex flex-col gap-0.5 overflow-y-auto">
      <div
        v-for="sprint in orderedSprints"
        :key="sprint.id"
        class="group flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
        :class="selectedView === sprint.id && 'bg-accent font-medium'"
        @click="selectView(sprint.id)"
      >
        <div class="flex items-center gap-2">
          <span class="flex-1 truncate">{{ sprint.name }}</span>
          <Icon
            name="i-lucide-pencil"
            class="size-3 shrink-0 opacity-0 group-hover:opacity-60"
            @click.stop="editSprintFromDrawer(sprint)"
          />
          <Icon
            name="i-lucide-trash-2"
            class="size-3 shrink-0 opacity-0 group-hover:opacity-60"
            @click.stop="deleteSprintFromDrawer(sprint)"
          />
        </div>
        <Badge variant="outline" class="w-fit text-[10px]" :class="SPRINT_STATUS_BADGE[sprint.status]">
          {{ sprint.status }}
        </Badge>
      </div>
      <p v-if="!orderedSprints.length" class="text-xs text-muted-foreground px-2 py-1">
        No sprints yet.
      </p>
    </div>
  </DefineSprintList>

  <div ref="boardRoot" class="flex gap-4" :style="{ height: boardHeight }">
    <div v-if="isDesktop" class="w-64 shrink-0 min-h-0 flex flex-col gap-2 border-r pr-4">
      <ReuseSprintList />
    </div>

    <div class="flex-1 min-w-0 min-h-0 flex flex-col gap-4">
      <div class="flex flex-wrap items-center gap-2">
        <div v-if="selectedSprint" class="flex items-center gap-2 mr-2">
          <span class="font-semibold text-sm">{{ selectedSprint.name }}</span>
          <Badge variant="outline" class="text-[10px]" :class="SPRINT_STATUS_BADGE[selectedSprint.status]">
            {{ selectedSprint.status }}
          </Badge>
          <span v-if="selectedSprint.startDate || selectedSprint.endDate" class="text-xs text-muted-foreground">
            {{ formatSprintDate(selectedSprint.startDate) ?? '—' }} – {{ formatSprintDate(selectedSprint.endDate) ?? '—' }}
          </span>
          <Button v-if="selectedSprint.status === 'planned'" size="sm" variant="outline" class="h-7" @click="startSprint(selectedSprint)">
            <Icon name="i-lucide-play" class="mr-1 h-3 w-3" />
            Start sprint
          </Button>
          <Button v-else-if="selectedSprint.status === 'active'" size="sm" variant="outline" class="h-7" @click="completeSprint(selectedSprint)">
            <Icon name="i-lucide-check" class="mr-1 h-3 w-3" />
            Complete sprint
          </Button>
        </div>
        <div v-else class="font-semibold text-sm mr-2">
          Backlog
        </div>

        <Button size="sm" @click="openNewTask">
          <Icon name="i-lucide-plus" class="mr-1.5 h-4 w-4" />
          New Task
        </Button>

        <template v-if="isDesktop">
          <Separator orientation="vertical" class="h-6 mx-1" />

          <Select v-model="assigneeFilter">
            <SelectTrigger class="h-8 w-auto gap-1.5 text-xs">
              <Icon name="i-lucide-user" class="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All assignees
              </SelectItem>
              <SelectItem value="unassigned">
                Unassigned
              </SelectItem>
              <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
                {{ member.name }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="priorityFilter">
            <SelectTrigger class="h-8 w-auto gap-1.5 text-xs">
              <Icon name="i-lucide-flag" class="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                All priorities
              </SelectItem>
              <SelectItem v-for="option in priorities" :key="option.value" :value="option.value">
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>

          <Select v-model="dueFilter">
            <SelectTrigger class="h-8 w-auto gap-1.5 text-xs">
              <Icon name="i-lucide-calendar-clock" class="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                Any due date
              </SelectItem>
              <SelectItem value="overdue">
                Overdue
              </SelectItem>
              <SelectItem value="due-soon">
                Due soon
              </SelectItem>
              <SelectItem value="none">
                No due date
              </SelectItem>
            </SelectContent>
          </Select>

          <Button v-if="hasActiveFilters" size="sm" variant="ghost" class="text-muted-foreground" @click="resetFilters">
            <Icon name="i-lucide-x" class="mr-1 h-3.5 w-3.5" />
            Clear filters
          </Button>
        </template>

        <template v-else>
          <Drawer v-model:open="showSprintDrawer">
            <DrawerTrigger as-child>
              <Button size="sm" variant="outline" class="gap-1.5 text-xs">
                <Icon name="i-lucide-list" class="h-3.5 w-3.5 text-muted-foreground" />
                Switch
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader class="sr-only">
                <DrawerTitle>Sprints</DrawerTitle>
                <DrawerDescription>Switch between the backlog and a sprint</DrawerDescription>
              </DrawerHeader>
              <div class="flex flex-col gap-2 px-4 pb-6 max-h-[70vh]">
                <ReuseSprintList />
              </div>
            </DrawerContent>
          </Drawer>

          <Drawer v-model:open="showFilterDrawer">
            <DrawerTrigger as-child>
              <Button size="sm" variant="outline" class="gap-1.5 text-xs">
                <Icon name="i-lucide-sliders-horizontal" class="h-3.5 w-3.5 text-muted-foreground" />
                Filters
                <Badge v-if="activeToolbarFilterCount" variant="secondary" class="h-4 min-w-4 px-1 text-[10px]">
                  {{ activeToolbarFilterCount }}
                </Badge>
              </Button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>Filters</DrawerTitle>
                <DrawerDescription class="sr-only">
                  Filter tasks by assignee, priority, and due date
                </DrawerDescription>
              </DrawerHeader>
              <div class="flex flex-col gap-3 px-4 pb-6">
                <Select v-model="assigneeFilter">
                  <SelectTrigger class="w-full gap-1.5 text-xs">
                    <Icon name="i-lucide-user" class="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All assignees
                    </SelectItem>
                    <SelectItem value="unassigned">
                      Unassigned
                    </SelectItem>
                    <SelectItem v-for="member in activeStaff" :key="member.id" :value="member.id">
                      {{ member.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="priorityFilter">
                  <SelectTrigger class="w-full gap-1.5 text-xs">
                    <Icon name="i-lucide-flag" class="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All priorities
                    </SelectItem>
                    <SelectItem v-for="option in priorities" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Select v-model="dueFilter">
                  <SelectTrigger class="w-full gap-1.5 text-xs">
                    <Icon name="i-lucide-calendar-clock" class="h-3.5 w-3.5 text-muted-foreground" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      Any due date
                    </SelectItem>
                    <SelectItem value="overdue">
                      Overdue
                    </SelectItem>
                    <SelectItem value="due-soon">
                      Due soon
                    </SelectItem>
                    <SelectItem value="none">
                      No due date
                    </SelectItem>
                  </SelectContent>
                </Select>

                <Button v-if="hasActiveFilters" size="sm" variant="ghost" class="text-muted-foreground self-start" @click="resetFilters">
                  <Icon name="i-lucide-x" class="mr-1 h-3.5 w-3.5" />
                  Clear filters
                </Button>
              </div>
            </DrawerContent>
          </Drawer>
        </template>
      </div>

      <Draggable
        v-model="statuses"
        item-key="id"
        handle=".column-drag-handle"
        :animation="180"
        class="flex-1 min-h-0 flex gap-4 overflow-x-auto overflow-y-hidden pb-4 snap-x snap-mandatory"
        @end="onColumnsReordered"
      >
        <template #item="{ element: col }: { element: { id: string, label: string } }">
          <div class="w-[85vw] max-w-[320px] md:w-[280px] shrink-0 min-h-0 flex flex-col gap-2 snap-center">
            <div class="column-drag-handle flex items-center gap-1 px-1 cursor-grab active:cursor-grabbing">
              <Icon name="i-lucide-grip-vertical" class="size-3.5 text-muted-foreground/50" />
              <Input
                v-if="renamingColumnId === col.id"
                v-model="renameValue"
                aria-label="Rename column"
                class="h-6 px-1 text-sm font-semibold"
                autofocus
                @keyup.enter="confirmRename"
                @keyup.esc="renamingColumnId = null"
                @blur="confirmRename"
                @click.stop
              />
              <h3 v-else class="font-semibold text-sm">
                {{ col.label }}
              </h3>
              <Badge variant="secondary" class="h-5 min-w-5 px-1 font-mono tabular-nums">
                {{ columnTasks[col.id]?.length ?? 0 }}
              </Badge>
              <div class="ml-auto flex items-center gap-0.5">
                <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground" @click="startRename(col)">
                  <Icon name="i-lucide-pencil" class="size-3" />
                </Button>
                <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground" @click="onDeleteColumn(col)">
                  <Icon name="i-lucide-trash-2" class="size-3" />
                </Button>
                <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground" @click="openNewTask">
                  <Icon name="i-lucide-plus" />
                </Button>
              </div>
            </div>

            <Draggable
              v-model="columnTasks[col.id]"
              :group="{ name: 'sprint-board', pull: true, put: true }"
              item-key="id"
              :animation="180"
              class="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto p-0.5"
              ghost-class="opacity-50"
              @change="(evt: any) => onChange(col.id, evt)"
            >
              <template #item="{ element: task }: { element: Task }">
                <div class="rounded-xl border bg-card px-3 py-2 shadow-sm hover:bg-accent/50">
                  <div class="flex items-start justify-between gap-2">
                    <span class="text-xs text-muted-foreground font-mono">{{ task.id }}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger as-child>
                        <Button size="icon-sm" variant="ghost" class="size-6 text-muted-foreground">
                          <Icon name="i-lucide-ellipsis-vertical" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem @click="openEdit(task)">
                          <Icon name="i-lucide-edit-2" class="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem @click="openNewSubtask(task.id)">
                          <Icon name="i-lucide-git-branch-plus" class="size-4" />
                          Add subtask
                        </DropdownMenuItem>
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger>
                            <Icon name="i-lucide-arrow-right-left" class="size-4" />
                            Move to sprint
                          </DropdownMenuSubTrigger>
                          <DropdownMenuSubContent>
                            <DropdownMenuItem :disabled="!task.sprintId" @click="moveToSprint(task, null)">
                              Backlog
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              v-for="sprint in orderedSprints"
                              :key="sprint.id"
                              :disabled="task.sprintId === sprint.id"
                              @click="moveToSprint(task, sprint.id)"
                            >
                              {{ sprint.name }}
                            </DropdownMenuItem>
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" class="text-destructive" @click="removeTask(task.id)">
                          <Icon name="i-lucide-trash-2" class="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <p class="font-medium leading-5 mt-1 cursor-pointer" @click="openEdit(task)">
                    {{ task.title }}
                  </p>

                  <div v-if="task.description" class="group/desc relative mt-1">
                    <p class="text-xs text-muted-foreground line-clamp-2 whitespace-pre-line">
                      {{ task.description }}
                    </p>
                    <div
                      class="invisible absolute inset-x-0 top-0 z-20 rounded-lg border bg-card p-2 text-xs whitespace-pre-line text-foreground opacity-0 shadow-lg transition-opacity duration-150 group-hover/desc:visible group-hover/desc:opacity-100"
                    >
                      {{ task.description }}
                    </div>
                  </div>

                  <Badge v-if="task.epicTitle" variant="outline" class="mt-2 gap-1.5">
                    <span class="size-2 rounded-full" :style="{ backgroundColor: task.epicColor }" />
                    {{ task.epicTitle }}
                  </Badge>

                  <div v-if="subtasksOf(task.id).length" class="mt-2">
                    <button type="button" class="text-xs text-muted-foreground flex items-center gap-1" @click="toggleExpanded(task.id)">
                      <Icon name="i-lucide-chevron-right" class="size-3 transition-transform" :class="expanded.has(task.id) && 'rotate-90'" />
                      Subtasks ({{ subtasksOf(task.id).filter(s => s.status === doneStatusId).length }}/{{ subtasksOf(task.id).length }})
                    </button>
                    <div v-if="expanded.has(task.id)" class="flex flex-col gap-1 pl-4 mt-1">
                      <label v-for="sub in subtasksOf(task.id)" :key="sub.id" class="flex items-center gap-2 text-xs">
                        <Checkbox :model-value="sub.status === doneStatusId" :aria-label="sub.title" @update:model-value="toggleSubtaskDone(sub)" />
                        <span :class="sub.status === doneStatusId && 'line-through text-muted-foreground'">{{ sub.title }}</span>
                      </label>
                    </div>
                  </div>

                  <div class="mt-3 flex items-center justify-between gap-2">
                    <div v-if="task.dueDate" class="flex items-center gap-1 text-xs" :class="DUE_BADGE_CLASS[getTaskDueStatus(task) ?? 'on-track']">
                      <Icon name="i-lucide-calendar" class="size-3" />
                      {{ formatDueDate(task) }}
                    </div>
                    <div v-else />
                    <div class="flex items-center gap-2">
                      <Badge v-if="priorityMeta(task.priority)" variant="outline" :class="priorityMeta(task.priority)?.badgeClass">
                        <component :is="priorityMeta(task.priority)?.icon" class="size-3" />
                      </Badge>
                      <div v-if="task.assignees.length" class="flex items-center -space-x-2">
                        <Tooltip v-for="assignee in task.assignees.slice(0, 3)" :key="assignee.id">
                          <TooltipTrigger as-child>
                            <Avatar class="size-6 border-2 border-card">
                              <AvatarFallback class="text-[10px]">
                                {{ initials(assignee.name) }}
                              </AvatarFallback>
                            </Avatar>
                          </TooltipTrigger>
                          <TooltipContent>
                            {{ assignee.name }}
                          </TooltipContent>
                        </Tooltip>
                        <div v-if="task.assignees.length > 3" class="flex size-6 items-center justify-center rounded-full border-2 border-card bg-muted text-[10px] font-medium">
                          +{{ task.assignees.length - 3 }}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </Draggable>
          </div>
        </template>

        <template #footer>
          <div class="w-[85vw] max-w-[320px] md:w-[280px] shrink-0 self-start snap-center">
            <div v-if="!addingColumn">
              <Button variant="ghost" class="w-full justify-start text-muted-foreground" @click="addingColumn = true">
                <Icon name="i-lucide-plus" class="mr-1.5 h-4 w-4" />
                Add Column
              </Button>
            </div>
            <div v-else class="flex flex-col gap-2 rounded-lg border p-2">
              <Input v-model="newColumnLabel" placeholder="Column name" aria-label="Column name" autofocus @keyup.enter="confirmAddColumn" @keyup.esc="addingColumn = false" />
              <div class="flex gap-2">
                <Button size="sm" @click="confirmAddColumn">
                  Add
                </Button>
                <Button size="sm" variant="ghost" @click="addingColumn = false">
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </template>
      </Draggable>
    </div>

    <TaskFormSheet
      v-model:open="formOpen"
      :task="formTask"
      :type="formType"
      :parent-task-id="formParentTaskId"
    />

    <SprintFormSheet
      v-model:open="sprintFormOpen"
      :sprint="editingSprint"
    />
  </div>
</template>
