<script setup lang="ts">
import SprintBoard from '~/components/tasks/SprintBoard.vue'

definePageMeta({
  middleware: 'bd',
})

const { fetchTasks } = useTasks()
const { fetchStatuses } = useTaskStatuses()
const { fetchSprints } = useSprints()

onMounted(async () => {
  // Sequential, not Promise.all — db0's postgresql connector shares a single client
  // and warns on overlapping concurrent queries.
  await fetchStatuses()
  await fetchSprints()
  await fetchTasks()
})
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Sprints
      </h2>
      <p class="text-muted-foreground">
        Plan sprints, move tasks between the backlog and an active sprint, and track progress on a kanban board.
      </p>
    </div>

    <SprintBoard />
  </div>
</template>
