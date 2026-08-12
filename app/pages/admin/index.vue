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

onMounted(() => {
  fetchStaff()
})

const isAddOpen = ref(false)

const isDetailOpen = ref(false)
const selectedStaff = ref<StaffMember | null>(null)

function openStaff(member: StaffMember) {
  selectedStaff.value = member
  isDetailOpen.value = true
}

const roleOptions = [
  { value: 'admin', label: 'Admin' },
  { value: 'agent', label: 'Agent' },
] as const

const staffFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  email: z.string().email({ message: 'Please enter a valid email address.' }),
  role: z.enum(['admin', 'agent'], { required_error: 'Please select a role.' }),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: staffFormSchema,
  initialValues: { name: '', email: '', role: 'agent' },
})

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
              Invite a new staff member and assign their role on the platform.
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

            <FormField v-slot="{ componentField }" name="role">
              <FormItem>
                <FormLabel>Role</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full">
                      <SelectValue placeholder="Select a role" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="option in roleOptions" :key="option.value" :value="option.value">
                      {{ option.label }}
                    </SelectItem>
                  </SelectContent>
                </Select>
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
            <TableHead>Role</TableHead>
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
                <Badge :variant="member.role === 'admin' ? 'default' : 'secondary'" class="capitalize">
                  {{ member.role }}
                </Badge>
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
