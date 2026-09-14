<script setup lang="ts">
import type { Project } from '~/types/project'
import ProjectDetailContent from './ProjectDetailContent.vue'

defineProps<{
  project: Project | null
}>()

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const open = defineModel<boolean>('open', { default: false })

function onDeleted() {
  open.value = false
  emit('deleted')
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-[80vw] p-0">
      <SheetTitle class="sr-only">
        {{ project?.name ?? 'Project' }}
      </SheetTitle>
      <SheetDescription class="sr-only">
        Project details, backlog, and Gantt chart
      </SheetDescription>
      <ProjectDetailContent :project="project" @deleted="onDeleted" />
    </SheetContent>
  </Sheet>
</template>
