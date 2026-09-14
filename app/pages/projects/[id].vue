<script setup lang="ts">
import ProjectDetailContent from '~/components/projects/ProjectDetailContent.vue'

definePageMeta({
  middleware: 'bd',
})

const route = useRoute()
const router = useRouter()
const { projects, fetchProject } = useProjects()

const projectId = computed(() => route.params.id as string)
const project = computed(() => projects.value.find(p => p.id === projectId.value) ?? null)
const isLoading = ref(true)

onMounted(async () => {
  try {
    await fetchProject(projectId.value)
  }
  finally {
    isLoading.value = false
  }
})

function onDeleted() {
  router.push('/projects')
}
</script>

<template>
  <div class="w-full flex flex-1 flex-col gap-4">
    <Button variant="ghost" size="sm" class="w-fit gap-1.5 -ml-2" @click="router.push('/projects')">
      <Icon name="i-lucide-arrow-left" class="size-4" />
      Back to Projects
    </Button>

    <p v-if="isLoading" class="text-sm text-muted-foreground">
      Loading…
    </p>
    <p v-else-if="!project" class="text-sm text-muted-foreground">
      Project not found.
    </p>
    <div v-else class="flex flex-1 flex-col rounded-md border">
      <ProjectDetailContent :project="project" @deleted="onDeleted" />
    </div>
  </div>
</template>
