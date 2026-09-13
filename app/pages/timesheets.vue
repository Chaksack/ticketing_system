<script setup lang="ts">
import { toast } from 'vue-sonner'

const { currentUser, isAdmin, isFinance, isEngineeringLead, isEngineeringCoordinator } = useAuth()
const { entries, fetchTimesheets, addTimesheet, removeTimesheet } = useTimesheets()
const { tasks, fetchTasks } = useTasks()
const { staff, fetchStaff } = useStaff()

const isCapacityViewer = computed(() => isAdmin.value || isFinance.value || isEngineeringLead.value || isEngineeringCoordinator.value)

const ALL_STAFF = '__all__'
const selectedStaffId = ref(currentUser.value?.id ?? '')

async function refresh() {
  if (selectedStaffId.value === ALL_STAFF)
    await fetchTimesheets({})
  else
    await fetchTimesheets({ staffId: selectedStaffId.value })
}

onMounted(async () => {
  await Promise.all([fetchTasks(), refresh()])
  if (isCapacityViewer.value && !staff.value.length)
    fetchStaff()
})

watch(selectedStaffId, refresh)

const myTasks = computed(() => tasks.value.filter(t => t.assignees.some(a => a.id === currentUser.value?.id)))

const taskId = ref('')
const workDate = ref(new Date().toISOString().slice(0, 10))
const hours = ref('')
const billable = ref(true)
const notes = ref('')
const isSaving = ref(false)

async function onLogTime() {
  if (!taskId.value || !hours.value.trim())
    return

  isSaving.value = true
  try {
    await addTimesheet({
      taskId: taskId.value,
      workDate: workDate.value,
      hours: Number(hours.value),
      billable: billable.value,
      notes: notes.value.trim() || undefined,
    })
    taskId.value = ''
    hours.value = ''
    notes.value = ''
    if (selectedStaffId.value !== currentUser.value?.id)
      await refresh()
    toast('Time logged')
  }
  catch (error: any) {
    toast.error('Could not log time', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

async function onDelete(id: string) {
  try {
    await removeTimesheet(id)
    toast('Entry removed')
  }
  catch (error: any) {
    toast.error('Could not remove entry', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Timesheets
        </h2>
        <p class="text-muted-foreground">
          Log hours against your tasks — it feeds project cost and team capacity reporting.
        </p>
      </div>

      <div v-if="isCapacityViewer" class="flex flex-col gap-1.5">
        <Label class="text-xs text-muted-foreground">Viewing</Label>
        <Select v-model="selectedStaffId">
          <SelectTrigger class="h-8 w-48 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem :value="currentUser?.id ?? ''">
              My Time
            </SelectItem>
            <SelectItem :value="ALL_STAFF">
              All Staff
            </SelectItem>
            <SelectItem v-for="member in staff" :key="member.id" :value="member.id">
              {{ member.name }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>

    <div class="flex flex-col gap-3 rounded-md border p-4">
      <h3 class="text-sm font-medium">
        Log Time
      </h3>
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-4">
        <Select v-model="taskId">
          <SelectTrigger class="h-8 text-xs">
            <SelectValue placeholder="Task" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="task in myTasks" :key="task.id" :value="task.id">
              {{ task.title }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input v-model="workDate" type="date" class="h-8 text-xs" />
        <Input v-model="hours" type="number" min="0.25" step="0.25" placeholder="Hours" class="h-8 text-xs" />
        <Input v-model="notes" placeholder="Notes (optional)" class="h-8 text-xs" />
      </div>
      <div class="flex items-center justify-between">
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox :model-value="billable" @update:model-value="(v) => billable = !!v" />
          Billable
        </label>
        <Button size="sm" :disabled="!taskId || !hours.trim() || isSaving" @click="onLogTime">
          Log Time
        </Button>
      </div>
      <p v-if="!myTasks.length" class="text-xs text-muted-foreground">
        You have no assigned tasks to log time against yet.
      </p>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead v-if="selectedStaffId === ALL_STAFF">
              Staff
            </TableHead>
            <TableHead>Task</TableHead>
            <TableHead>Project</TableHead>
            <TableHead class="text-right">
              Hours
            </TableHead>
            <TableHead>Billable</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="entries.length">
            <TableRow v-for="entry in entries" :key="entry.id">
              <TableCell class="text-sm">
                {{ formatDate(entry.workDate) }}
              </TableCell>
              <TableCell v-if="selectedStaffId === ALL_STAFF" class="text-sm">
                {{ entry.staffName || '—' }}
              </TableCell>
              <TableCell class="text-sm">
                {{ entry.taskTitle || '—' }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ entry.projectName || '—' }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ entry.hours }}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {{ entry.billable ? 'Yes' : 'No' }}
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  v-if="entry.staffId === currentUser?.id || isAdmin"
                  size="icon-sm" variant="ghost" class="text-destructive"
                  @click="onDelete(entry.id)"
                >
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="selectedStaffId === ALL_STAFF ? 7 : 6" class="h-24 text-center">
              No time logged yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
