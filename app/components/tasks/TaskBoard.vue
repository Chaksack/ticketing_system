<script setup lang="ts">
import type { Task, TaskStatus } from '~/types/task'
import Draggable from 'vuedraggable'
import { priorities, statuses } from './data'
import TaskFormSheet from './TaskFormSheet.vue'

const { tasks, epics, updateTask, removeTask, subtasksOf } = useTasks()

const STATUS_COLUMNS = statuses.map(s => ({ value: s.value as TaskStatus, label: s.label }))

const activeEpicFilter = ref<string | null>(null)

const columnTasks = reactive<Record<TaskStatus, Task[]>>({
  backlog: [],
  todo: [],
  in_progress: [],
  in_review: [],
  done: [],
})

function syncColumns() {
  for (const col of STATUS_COLUMNS) {
    columnTasks[col.value] = tasks.value.filter(t =>
      t.type === 'task'
      && t.status === col.value
      && (!activeEpicFilter.value || t.epicId === activeEpicFilter.value),
    )
  }
}

watch([tasks, activeEpicFilter], syncColumns, { immediate: true, deep: true })

async function onChange(status: TaskStatus, evt: any) {
  if (evt.added)
    await updateTask(evt.added.element.id, { status })
}

function toggleEpicFilter(epicId: string) {
  activeEpicFilter.value = activeEpicFilter.value === epicId ? null : epicId
}

const expanded = reactive<Set<string>>(new Set())
function toggleExpanded(taskId: string) {
  if (expanded.has(taskId))
    expanded.delete(taskId)
  else
    expanded.add(taskId)
}

async function toggleSubtaskDone(subtask: Task) {
  await updateTask(subtask.id, { status: subtask.status === 'done' ? 'todo' : 'done' })
}

const formOpen = ref(false)
const formType = ref<'epic' | 'task' | 'subtask'>('task')
const formTask = ref<Task | null>(null)
const formParentTaskId = ref<string | undefined>()

function openNewEpic() {
  formTask.value = null
  formType.value = 'epic'
  formParentTaskId.value = undefined
  formOpen.value = true
}

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

const DUE_BADGE_CLASS: Record<string, string> = {
  'on-track': 'text-muted-foreground',
  'due-soon': 'text-amber-600 dark:text-amber-400',
  'overdue': 'text-destructive',
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <div class="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="outline" @click="openNewEpic">
        <Icon name="i-lucide-flag" class="mr-1.5 h-4 w-4" />
        New Epic
      </Button>
      <Button size="sm" @click="openNewTask">
        <Icon name="i-lucide-plus" class="mr-1.5 h-4 w-4" />
        New Task
      </Button>
      <Separator orientation="vertical" class="h-6 mx-1" />
      <Button
        v-for="epic in epics"
        :key="epic.id"
        size="sm"
        variant="outline"
        class="gap-1.5"
        :class="activeEpicFilter === epic.id && 'border-2'"
        :style="activeEpicFilter === epic.id ? { borderColor: epic.color } : {}"
        @click="toggleEpicFilter(epic.id)"
      >
        <span class="size-2 rounded-full" :style="{ backgroundColor: epic.color }" />
        {{ epic.title }}
        <Icon name="i-lucide-pencil" class="size-3 opacity-60" @click.stop="openEdit(epic)" />
      </Button>
    </div>

    <div class="flex gap-4 overflow-x-auto overflow-y-hidden pb-4">
      <div v-for="col in STATUS_COLUMNS" :key="col.value" class="w-[280px] shrink-0 flex flex-col gap-2">
        <div class="flex items-center gap-2 px-1">
          <h3 class="font-semibold text-sm">
            {{ col.label }}
          </h3>
          <Badge variant="secondary" class="h-5 min-w-5 px-1 font-mono tabular-nums">
            {{ columnTasks[col.value].length }}
          </Badge>
          <Button size="icon-sm" variant="ghost" class="ml-auto size-6 text-muted-foreground" @click="openNewTask">
            <Icon name="i-lucide-plus" />
          </Button>
        </div>

        <Draggable
          v-model="columnTasks[col.value]"
          :group="{ name: 'task-board', pull: true, put: true }"
          item-key="id"
          :animation="180"
          class="flex flex-col gap-3 min-h-6 p-0.5"
          ghost-class="opacity-50"
          @change="(evt: any) => onChange(col.value, evt)"
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

              <Badge v-if="task.epicTitle" variant="outline" class="mt-2 gap-1.5">
                <span class="size-2 rounded-full" :style="{ backgroundColor: task.epicColor }" />
                {{ task.epicTitle }}
              </Badge>

              <div v-if="subtasksOf(task.id).length" class="mt-2">
                <button type="button" class="text-xs text-muted-foreground flex items-center gap-1" @click="toggleExpanded(task.id)">
                  <Icon name="i-lucide-chevron-right" class="size-3 transition-transform" :class="expanded.has(task.id) && 'rotate-90'" />
                  Subtasks ({{ subtasksOf(task.id).filter(s => s.status === 'done').length }}/{{ subtasksOf(task.id).length }})
                </button>
                <div v-if="expanded.has(task.id)" class="flex flex-col gap-1 pl-4 mt-1">
                  <label v-for="sub in subtasksOf(task.id)" :key="sub.id" class="flex items-center gap-2 text-xs">
                    <Checkbox :model-value="sub.status === 'done'" :aria-label="sub.title" @update:model-value="toggleSubtaskDone(sub)" />
                    <span :class="sub.status === 'done' && 'line-through text-muted-foreground'">{{ sub.title }}</span>
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
                  <Tooltip v-if="task.assigneeName">
                    <TooltipTrigger as-child>
                      <Avatar class="size-6">
                        <AvatarFallback class="text-[10px]">
                          {{ initials(task.assigneeName) }}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      {{ task.assigneeName }}
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </template>
        </Draggable>
      </div>
    </div>

    <TaskFormSheet
      v-model:open="formOpen"
      :task="formTask"
      :type="formType"
      :parent-task-id="formParentTaskId"
    />
  </div>
</template>
