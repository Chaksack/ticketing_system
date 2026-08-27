<script setup lang="ts">
import type { StaffMember } from '~/types/staff'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { roleBadgeClass, statusBadgeClass } from '~/components/admin/data'

definePageMeta({
  middleware: 'admin',
})

const { staff, fetchStaff, addStaff } = useStaff()
const { getPresence, fetchPresences } = usePresence()
const route = useRoute()

onMounted(async () => {
  if (!staff.value.length)
    await fetchStaff()
  await fetchPresences()
})

const searchQuery = ref('')
const roleFilter = ref('all')
const statusFilter = ref('all')

const filteredStaff = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()

  return staff.value.filter((member) => {
    if (roleFilter.value !== 'all' && !member.roles.includes(roleFilter.value as StaffMember['roles'][number]))
      return false
    if (statusFilter.value !== 'all' && member.status !== statusFilter.value)
      return false
    if (query && !member.name.toLowerCase().includes(query) && !member.email.toLowerCase().includes(query))
      return false
    return true
  })
})

const isAddOpen = ref(false)

const isDetailOpen = ref(false)
const selectedStaffId = ref<string | null>(null)
const selectedStaff = computed(() => staff.value.find(s => s.id === selectedStaffId.value) ?? null)

function openStaff(member: StaffMember) {
  selectedStaffId.value = member.id
  isDetailOpen.value = true
}

watch(() => route.query.open, async (openId) => {
  if (typeof openId !== 'string')
    return

  if (!staff.value.length)
    await fetchStaff()

  const member = staff.value.find(s => s.id === openId)
  if (member)
    openStaff(member)
}, { immediate: true })

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
  { value: 'bd', label: 'BD Executive' },
  { value: 'sm', label: 'Sales & Marketing Exec' },
] as const

const staffFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  roles: z.array(z.enum(['admin', 'agent', 'bd', 'sm'])).min(1, { message: 'Select at least one role.' }),
}))

const { handleSubmit, resetForm, values, setFieldValue } = useForm({
  validationSchema: staffFormSchema,
  initialValues: { name: '', email: '', roles: ['agent'] },
})

function toggleRole(value: 'admin' | 'agent' | 'bd' | 'sm', checked: boolean) {
  const current = values.roles ?? []
  setFieldValue('roles', checked ? [...current, value] : current.filter(r => r !== value))
}

const onSubmit = handleSubmit(async (values) => {
  try {
    const { emailSent } = await addStaff(values)
    resetForm()
    isAddOpen.value = false
    toast('Staff member added', {
      description: emailSent
        ? `An invite email was sent to ${values.email}.`
        : `${values.name} was added, but the invite email failed to send. Share the invite link manually.`,
    })
  }
  catch (error: any) {
    toast.error('Could not add staff member', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Admin
        </h2>
        <p class="text-muted-foreground">
          Manage staff members who have access to the platform.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-user-plus" class="mr-2 h-4 w-4" />
            Add Staff Member
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>Add Staff Member</SheetTitle>
            <SheetDescription>
              Invite a new staff member and assign their role(s) on the platform.
            </SheetDescription>
          </SheetHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="Jane Doe" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="email">
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="jane@example.com" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField name="roles">
              <FormItem>
                <FormLabel>Roles</FormLabel>
                <FormControl>
                  <div class="flex flex-col gap-2">
                    <label v-for="option in roleOptions" :key="option.value" :for="`role-${option.value}`" class="flex items-center gap-2 text-sm">
                      <Checkbox
                        :id="`role-${option.value}`"
                        :model-value="values.roles?.includes(option.value)"
                        @update:model-value="(checked) => toggleRole(option.value, !!checked)"
                      />
                      {{ option.label }}
                    </label>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <SheetFooter class="p-0">
              <Button type="submit">
                Add Staff Member
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <AdminOnCallPanel />

    <div class="flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[200px] max-w-sm">
        <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input v-model="searchQuery" placeholder="Search staff..." class="pl-8" />
      </div>
      <Select v-model="roleFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All roles
          </SelectItem>
          <SelectItem v-for="option in roleOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>
      <Select v-model="statusFilter">
        <SelectTrigger class="h-9 w-auto gap-1.5 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">
            All statuses
          </SelectItem>
          <SelectItem value="active">
            Active
          </SelectItem>
          <SelectItem value="pending">
            Pending
          </SelectItem>
          <SelectItem value="disabled">
            Disabled
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Roles</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>On-Call</TableHead>
            <TableHead>Joined</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredStaff.length">
            <TableRow
              v-for="member in filteredStaff"
              :key="member.id"
              class="cursor-pointer"
              @click="openStaff(member)"
            >
              <TableCell class="font-medium">
                <div class="flex items-center gap-1.5">
                  <PresenceDot :state="getPresence(member.id)?.state" />
                  {{ member.name }}
                  <span v-if="getPresence(member.id)?.statusText" class="font-normal text-xs text-muted-foreground">
                    <span v-if="getPresence(member.id)?.statusEmoji">{{ getPresence(member.id)?.statusEmoji }}</span>
                    {{ getPresence(member.id)?.statusText }}
                  </span>
                </div>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ member.email }}
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="role in member.roles" :key="role" variant="outline" class="capitalize" :class="roleBadgeClass[role]">
                    {{ role }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" class="capitalize" :class="statusBadgeClass[member.status]">
                  {{ member.status }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge v-if="member.onCall" variant="outline" class="gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                  <Icon name="i-lucide-radio" class="h-3 w-3" />
                  On-call
                </Badge>
                <span v-else class="text-sm text-muted-foreground">—</span>
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(member.createdAt) }}
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="6" class="h-24 text-center">
              No staff members match your filters.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <AdminStaffDetailSheet v-model:open="isDetailOpen" :staff="selectedStaff" />
  </div>
</template>
