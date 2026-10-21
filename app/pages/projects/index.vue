<script setup lang="ts">
import type { Project } from '~/types/project'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { projectStatuses } from '~/components/projects/data'
import { optionalAmount } from '~/lib/formNumbers'
import { DEFAULT_PROJECT_CURRENCY, formatProjectMoney, PROJECT_CURRENCIES, PROJECT_STATUS_PROGRESS } from '~/types/project'

const PROGRESS_BAR_CLASS: Record<string, string> = {
  planned: 'bg-muted-foreground/50',
  active: 'bg-primary',
  on_hold: 'bg-amber-500',
  completed: 'bg-emerald-500',
  cancelled: 'bg-destructive',
}

definePageMeta({
  middleware: 'bd',
})

const { projects, fetchProjects, addProject } = useProjects()
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

const statusTabs = computed(() => [
  { value: 'all', label: 'All', count: projects.value.length },
  ...projectStatuses.map(option => ({ value: option.value as string, label: option.label, count: projects.value.filter(project => project.status === option.value).length })),
])

function exportProjects() {
  downloadCsv('projects.csv', ['ID', 'Name', 'Client', 'Status', 'Start', 'End', 'Currency', 'Contract value', 'Margin', 'Amount due'], filteredProjects.value.map(project => [
    project.id,
    project.name,
    project.clientName,
    statusLabel(project.status),
    project.startDate?.slice(0, 10),
    project.endDate?.slice(0, 10),
    project.currency,
    project.contractValue,
    project.margin,
    project.amountDue,
  ]))
}

function money(project: Project, value?: number) {
  return value === undefined ? '—' : formatProjectMoney(project.currency, value, 0)
}

function openProject(project: Project) {
  navigateTo(`/projects/${project.id}`)
}

// Older links (notifications, search) use /projects?open=<id>.
watch(() => route.query.open, (openId) => {
  if (typeof openId === 'string')
    navigateTo(`/projects/${openId}`, { replace: true })
}, { immediate: true })

const isAddOpen = ref(false)

const projectFormSchema = toTypedSchema(z.object({
  clientId: z.string().min(1, { message: 'Select a client.' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().optional(),
  status: z.enum(['planned', 'active', 'on_hold', 'completed', 'cancelled']),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currency: z.enum(['GHS', 'USD']),
  contractValue: optionalAmount(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: projectFormSchema,
  initialValues: { clientId: '', name: '', description: '', status: 'planned', startDate: '', endDate: '', currency: DEFAULT_PROJECT_CURRENCY, contractValue: undefined },
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
  return value ? new Date(value).toLocaleDateString(APP_LOCALE, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <PageActions label="Project actions">
      <Button variant="lime" @click="isAddOpen = true">
        <Icon name="i-lucide-plus" />
        New project
      </Button>
      <Button variant="ghost" :disabled="!filteredProjects.length" @click="exportProjects">
        <Icon name="i-lucide-download" />
        Export
      </Button>
    </PageActions>

    <PageTitle title="Projects">
      <template #aside>
        <PageSegmentedTabs v-model="statusFilter" label="Status" :options="statusTabs" />
      </template>
    </PageTitle>

    <Sheet v-model:open="isAddOpen">
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

          <div class="grid grid-cols-2 gap-4">
            <FormField v-slot="{ componentField }" name="currency">
              <FormItem>
                <FormLabel>Currency</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="option in PROJECT_CURRENCIES" :key="option.code" :value="option.code">
                      {{ option.symbol }} {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="contractValue">
              <FormItem>
                <FormLabel>Project Value (optional)</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="0.01" placeholder="What the client pays" v-bind="componentField" />
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

    <div class="flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search projects..." class="pl-8" />
      </div>
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

    <div class="rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Progress</TableHead>
            <TableHead>Start</TableHead>
            <TableHead>End</TableHead>
            <TableHead>Tasks</TableHead>
            <TableHead>AMC Contracts</TableHead>
            <TableHead class="text-right">
              Value
            </TableHead>
            <TableHead class="text-right">
              Margin
            </TableHead>
            <TableHead class="text-right">
              Due
            </TableHead>
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
              <TableCell>
                <div class="flex items-center gap-2">
                  <div class="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                    <div
                      class="h-full rounded-full"
                      :class="PROGRESS_BAR_CLASS[project.status]"
                      :style="{ width: `${PROJECT_STATUS_PROGRESS[project.status]}%` }"
                    />
                  </div>
                  <span class="text-xs text-muted-foreground">{{ PROJECT_STATUS_PROGRESS[project.status] }}%</span>
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(project.startDate) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(project.endDate) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ project.taskCount }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ project.contracts.length }}
              </TableCell>
              <TableCell class="text-right tabular-nums">
                {{ money(project, project.contractValue) }}
              </TableCell>
              <TableCell
                class="text-right tabular-nums"
                :class="project.margin !== undefined && project.margin < 0 ? 'text-destructive' : ''"
              >
                {{ money(project, project.margin) }}
              </TableCell>
              <TableCell
                class="text-right tabular-nums"
                :class="project.amountDue !== undefined && project.amountDue > 0 ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-muted-foreground'"
              >
                {{ money(project, project.amountDue) }}
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="11" class="h-24 text-center">
              No projects match your filters.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
