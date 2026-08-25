<script setup lang="ts">
import TaskBoard from '~/components/tasks/TaskBoard.vue'

definePageMeta({
  middleware: 'bd',
})

const { fetchTasks } = useTasks()
const { fetchStatuses } = useTaskStatuses()

onMounted(async () => {
  // Sequential, not Promise.all — db0's postgresql connector shares a single client
  // and warns on overlapping concurrent queries.
  await fetchStatuses()
  await fetchTasks()
})
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Tasks
      </h2>
      <p class="text-muted-foreground">
        Organize work into epics, tasks, and subtasks — with assignees, deadlines, and reminders.
      </p>
    </div>

    <TaskBoard />
  </div>
</template>
