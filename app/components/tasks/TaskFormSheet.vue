<script setup lang="ts">
import type { Task, TaskPriority, TaskStatus, TaskType } from '~/types/task'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'
import { epicColors, priorities } from './data'

const props = defineProps<{
  task?: Task | null
  type?: TaskType
  parentTaskId?: string
}>()

const open = defineModel<boolean>('open', { default: false })

const { addTask, updateTask, epics } = useTasks()
const { staff, fetchStaff } = useStaff()
const { statuses, fetchStatuses } = useTaskStatuses()
const { sprints, fetchSprints } = useSprints()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
  if (!statuses.value.length)
    fetchStatuses()
  if (!sprints.value.length)
    fetchSprints()
})

const activeStaff = computed(() => staff.value.filter(s => s.status === 'active'))
const isEditing = computed(() => !!props.task)
const effectiveType = computed<TaskType>(() => props.task?.type ?? props.type ?? 'task')

const titleLabel = computed(() => {
  if (effectiveType.value === 'epic')
    return isEditing.value ? 'Edit Epic' : 'New Epic'
  if (effectiveType.value === 'subtask')
    return isEditing.value ? 'Edit Subtask' : 'New Subtask'
  return isEditing.value ? 'Edit Task' : 'New Task'
})

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

const startField = useDateTimeField()
const dueField = useDateTimeField()
const remindField = useDateTimeField()

const defaultStatusId = computed(() => statuses.value.find(s => s.id === 'todo')?.id ?? statuses.value[0]?.id ?? 'todo')

const title = ref('')
const description = ref('')
const status = ref<TaskStatus>('todo')
const priority = ref<TaskPriority>('medium')
const assigneeIds = ref<string[]>([])
const epicId = ref('none')
const sprintId = ref('none')
const color = ref<string>(epicColors[0]!)

function resetForm() {
  title.value = ''
  description.value = ''
  status.value = defaultStatusId.value
  priority.value = 'medium'
  assigneeIds.value = []
  epicId.value = 'none'
  sprintId.value = 'none'
  color.value = epicColors[0]!
  startField.reset()
  dueField.reset()
  remindField.reset()
}

watch(open, (isOpen) => {
  if (!isOpen)
    return

  if (props.task) {
    title.value = props.task.title
    description.value = props.task.description ?? ''
    status.value = props.task.status
    priority.value = props.task.priority
    assigneeIds.value = props.task.assignees.map(a => a.id)
    epicId.value = props.task.epicId ?? 'none'
    sprintId.value = props.task.sprintId ?? 'none'
    color.value = props.task.color ?? epicColors[0]!
    startField.setFromIso(props.task.startDate)
    dueField.setFromIso(props.task.dueDate)
    remindField.setFromIso(props.task.remindAt)
  }
  else {
    resetForm()
  }
})

async function onSubmit() {
  if (!title.value.trim())
    return

  const payload = {
    title: title.value.trim(),
    description: description.value.trim() || undefined,
    status: status.value,
    priority: priority.value,
    color: effectiveType.value === 'epic' ? color.value : undefined,
    assigneeIds: assigneeIds.value,
    epicId: effectiveType.value === 'task' && epicId.value !== 'none' ? epicId.value : undefined,
    sprintId: effectiveType.value !== 'epic' && sprintId.value !== 'none' ? sprintId.value : undefined,
    startDate: startField.toIso(),
    dueDate: dueField.toIso(),
    remindAt: remindField.toIso(),
  }

  try {
    if (isEditing.value && props.task) {
      await updateTask(props.task.id, payload)
      toast('Saved', { description: `${title.value} was updated.` })
    }
    else {
      await addTask({
        ...payload,
        type: effectiveType.value,
        parentTaskId: props.parentTaskId,
      })
      toast('Created', { description: `${title.value} was added.` })
    }
    open.value = false
  }
  catch (error: any) {
    toast.error('Could not save', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
      <SheetHeader class="p-0">
        <SheetTitle>{{ titleLabel }}</SheetTitle>
        <SheetDescription class="sr-only">
          {{ titleLabel }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-4 py-4">
        <div class="flex flex-col gap-1.5">
          <Label>Title</Label>
          <Input v-model="title" placeholder="Title" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Description</Label>
          <Textarea v-model="description" placeholder="Description (optional)" rows="3" />
        </div>

        <div v-if="effectiveType === 'epic'" class="flex flex-col gap-1.5">
          <Label>Color</Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="swatch in epicColors"
              :key="swatch"
              type="button"
              class="size-7 rounded-full border-2 transition-transform"
              :class="color === swatch ? 'border-foreground scale-110' : 'border-transparent'"
              :style="{ backgroundColor: swatch }"
              @click="color = swatch"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div class="flex flex-col gap-1.5">
            <Label>Status</Label>
            <Select v-model="status">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in statuses" :key="option.id" :value="option.id">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Priority</Label>
            <Select v-model="priority">
              <SelectTrigger class="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in priorities" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div v-if="effectiveType === 'task'" class="flex flex-col gap-1.5">
          <Label>Epic (optional)</Label>
          <Select v-model="epicId">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                No epic
              </SelectItem>
              <SelectItem v-for="epic in epics" :key="epic.id" :value="epic.id">
                <span class="flex items-center gap-2">
                  <span class="size-2 rounded-full" :style="{ backgroundColor: epic.color }" />
                  {{ epic.title }}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="effectiveType !== 'epic'" class="flex flex-col gap-1.5">
          <Label>Sprint (optional)</Label>
          <Select v-model="sprintId">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                Backlog
              </SelectItem>
              <SelectItem v-for="sprint in sprints" :key="sprint.id" :value="sprint.id">
                {{ sprint.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Assignees</Label>
          <StaffAssigneePicker v-model="assigneeIds" :staff="activeStaff" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Start Date</Label>
          <div class="flex items-center gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" :class="cn('flex-1 justify-start text-left font-normal px-3', !startField.date.value && 'text-muted-foreground')">
                  <Icon name="i-lucide-calendar" class="mr-2 h-4 w-4" />
                  {{ startField.date.value ? df.format(startField.date.value.toDate(getLocalTimeZone())) : 'Pick a date' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="startField.date.value" initial-focus />
              </PopoverContent>
            </Popover>
            <Input
              v-model="startField.time.value"
              type="time"
              step="60"
              class="flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Due Date (deadline)</Label>
          <div class="flex items-center gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" :class="cn('flex-1 justify-start text-left font-normal px-3', !dueField.date.value && 'text-muted-foreground')">
                  <Icon name="i-lucide-calendar" class="mr-2 h-4 w-4" />
                  {{ dueField.date.value ? df.format(dueField.date.value.toDate(getLocalTimeZone())) : 'Pick a date' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="dueField.date.value" initial-focus />
              </PopoverContent>
            </Popover>
            <Input
              v-model="dueField.time.value"
              type="time"
              step="60"
              class="flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Remind me at</Label>
          <div class="flex items-center gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" :class="cn('flex-1 justify-start text-left font-normal px-3', !remindField.date.value && 'text-muted-foreground')">
                  <Icon name="i-lucide-alarm-clock" class="mr-2 h-4 w-4" />
                  {{ remindField.date.value ? df.format(remindField.date.value.toDate(getLocalTimeZone())) : 'No reminder' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="remindField.date.value" initial-focus />
              </PopoverContent>
            </Popover>
            <Input
              v-model="remindField.time.value"
              type="time"
              step="60"
              class="flex-1 bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
            />
          </div>
        </div>
      </div>

      <SheetFooter class="p-0">
        <Button variant="secondary" @click="open = false">
          Cancel
        </Button>
        <Button @click="onSubmit">
          {{ isEditing ? 'Update' : 'Create' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
