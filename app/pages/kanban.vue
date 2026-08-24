<script setup lang="ts">
import KanbanBoard from '~/components/kanban/KanbanBoard.vue'
</script>

<template>
  <div class="h-full">
    <div class="flex flex-col gap-4 h-full">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Kanban Board
        </h2>
        <p class="text-muted-foreground">
          Drag tickets between columns to update their status.
        </p>
      </div>
      <KanbanBoard />
    </div>
  </div>
</template>
