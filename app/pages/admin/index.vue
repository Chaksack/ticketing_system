<script setup lang="ts">
import type { StaffMember } from '~/types/staff'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'

definePageMeta({
  middleware: 'admin',
})

const { staff, fetchStaff, addStaff } = useStaff()
const route = useRoute()

onMounted(async () => {
  await fetchStaff()

  const openId = route.query.open
  if (typeof openId === 'string') {
    const member = staff.value.find(s => s.id === openId)
    if (member)
      openStaff(member)
  }
})

const isAddOpen = ref(false)

const isDetailOpen = ref(false)
const selectedStaffId = ref<string | null>(null)
const selectedStaff = computed(() => staff.value.find(s => s.id === selectedStaffId.value) ?? null)

function openStaff(member: StaffMember) {
  selectedStaffId.value = member.id
  isDetailOpen.value = true
}

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
    toast('Could not add staff member', {
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

      <Dialog v-model:open="isAddOpen">
        <DialogTrigger as-child>
          <Button>
            <Icon name="i-lucide-user-plus" class="mr-2 h-4 w-4" />
            Add Staff Member
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Invite a new staff member and assign their role(s) on the platform.
            </DialogDescription>
          </DialogHeader>

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

            <DialogFooter>
              <Button type="submit">
                Add Staff Member
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <AdminOnCallPanel />

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
          <template v-if="staff.length">
            <TableRow
              v-for="member in staff"
              :key="member.id"
              class="cursor-pointer"
              @click="openStaff(member)"
            >
              <TableCell class="font-medium">
                {{ member.name }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ member.email }}
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="role in member.roles" :key="role" :variant="role === 'admin' ? 'default' : 'secondary'" class="capitalize">
                    {{ role }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  :variant="member.status === 'active' ? 'secondary' : member.status === 'pending' ? 'outline' : 'destructive'"
                  class="capitalize"
                >
                  {{ member.status }}
                </Badge>
              </TableCell>
              <TableCell>
                <Badge v-if="member.onCall" variant="secondary" class="gap-1">
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
              No staff members yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <AdminStaffDetailSheet v-model:open="isDetailOpen" :staff="selectedStaff" />
  </div>
</template>
