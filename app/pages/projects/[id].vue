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
  <div class="mx-auto flex w-full max-w-[1360px] flex-1 flex-col gap-4">
    <PageActions label="Project actions">
      <Button variant="ghost" size="icon" as-child aria-label="Back to projects">
        <NuxtLink to="/projects">
          <Icon name="i-lucide-arrow-left" />
        </NuxtLink>
      </Button>
      <Button variant="ghost" as-child>
        <NuxtLink to="/timesheets">
          Timesheets
        </NuxtLink>
      </Button>
      <Button v-if="project?.clientId" variant="ghost" as-child>
        <NuxtLink :to="`/clients/${project.clientId}`">
          Open client
        </NuxtLink>
      </Button>
    </PageActions>

    <p v-if="isLoading" class="text-sm text-muted-foreground">
      Loading…
    </p>
    <p v-else-if="!project" class="text-sm text-muted-foreground">
      Project not found.
    </p>
    <div v-else class="flex flex-1 flex-col overflow-hidden rounded-[28px] bg-card ring-1 ring-black/10 dark:ring-white/10">
      <ProjectDetailContent :project="project" @deleted="onDeleted" />
    </div>
  </div>
</template>
