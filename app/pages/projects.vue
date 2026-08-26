<script setup lang="ts">
import type { Project } from '~/types/project'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { projectStatuses } from '~/components/projects/data'
import ProjectDetailSheet from '~/components/projects/ProjectDetailSheet.vue'

definePageMeta({
  middleware: 'bd',
})

const { projects, fetchProjects, fetchProject, addProject } = useProjects()
const { clients, fetchClients } = useClients()
const route = useRoute()

onMounted(async () => {
  await Promise.all([fetchProjects(), fetchClients()])
})

function statusLabel(value: string) {
  return projectStatuses.find(s => s.value === value)?.label ?? value
}

function statusBadgeClass(value: string) {
  return projectStatuses.find(s => s.value === value)?.badgeClass
}

const searchQuery = ref('')
const statusFilter = ref('all')
const clientFilter = ref('all')

const filteredProjects = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return projects.value.filter((project) => {
    if (statusFilter.value !== 'all' && project.status !== statusFilter.value)
      return false
    if (clientFilter.value !== 'all' && project.clientId !== clientFilter.value)
      return false
    if (query && !project.name.toLowerCase().includes(query) && !(project.clientName ?? '').toLowerCase().includes(query))
      return false
    return true
  })
})

const isDetailOpen = ref(false)
const selectedProjectId = ref<string | null>(null)
const selectedProject = computed(() => projects.value.find(p => p.id === selectedProjectId.value) ?? null)

async function openProject(project: Project) {
  selectedProjectId.value = project.id
  isDetailOpen.value = true
  await fetchProject(project.id)
}

watch(() => route.query.open, async (openId) => {
  if (typeof openId === 'string')
    await openProject({ id: openId } as Project)
}, { immediate: true })

const isAddOpen = ref(false)

const projectFormSchema = toTypedSchema(z.object({
  clientId: z.string().min(1, { message: 'Select a client.' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().optional(),
  status: z.enum(['planned', 'active', 'on_hold', 'completed', 'cancelled']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: projectFormSchema,
  initialValues: { clientId: '', name: '', description: '', status: 'planned', startDate: '', endDate: '' },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    const project = await addProject(values)
    resetForm()
    isAddOpen.value = false
    toast('Project created', {
      description: `${project.name} was added.`,
    })
  }
  catch (error: any) {
    toast.error('Could not create project', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Projects
        </h2>
        <p class="text-muted-foreground">
          Track client projects and the AMC contracts tied to each one.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Project
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New Project</SheetTitle>
            <SheetDescription>
              Create a project under a client.
            </SheetDescription>
          </SheetHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="clientId">
              <FormItem>
                <FormLabel>Client</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="c in clients" :key="c.id" :value="c.id">
                      {{ c.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Project Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. HQ Building Automation" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="description">
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Textarea rows="3" placeholder="What's this project about..." v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="status">
              <FormItem>
                <FormLabel>Status</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="option in projectStatuses" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-2 gap-4">
              <FormField v-slot="{ componentField }" name="startDate">
                <FormItem>
                  <FormLabel>Start Date</FormLabel>
                  <FormControl>
                    <Input type="date" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="endDate">
                <FormItem>
                  <FormLabel>End Date</FormLabel>
                  <FormControl>
                    <Input type="date" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <SheetFooter class="p-0">
              <Button type="submit">
                Create Project
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search projects..." class="pl-8" />
      </div>
      <Select v-model="statusFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All statuses
          </SelectItem>
          <SelectItem v-for="option in projectStatuses" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="clientFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All clients
          </SelectItem>
          <SelectItem v-for="c in clients" :key="c.id" :value="c.id">
            {{ c.name }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>AMC Contracts</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredProjects.length">
            <TableRow
              v-for="project in filteredProjects"
              :key="project.id"
              class="cursor-pointer"
              @click="openProject(project)"
            >
              <TableCell class="font-medium">
                {{ project.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ project.clientName ?? '—' }}
              </TableCell>
              <TableCell>
                <Badge variant="outline" :class="statusBadgeClass(project.status)">
                  {{ statusLabel(project.status) }}
                </Badge>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(project.startDate) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(project.endDate) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ project.contracts.length }}
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="6" class="h-24 text-center">
              No projects match your filters.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ProjectDetailSheet v-model:open="isDetailOpen" :project="selectedProject" />
  </div>
</template>
