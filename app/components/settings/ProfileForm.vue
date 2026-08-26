<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  agent: 'Agent',
  bd: 'BD Executive',
  sm: 'Sales & Marketing Exec',
}

const { currentUser } = useAuth()
const { staff, fetchStaff } = useStaff()

onMounted(() => {
  if (!staff.value.length)
    fetchStaff()
})

const myRecord = computed(() => staff.value.find(s => s.id === currentUser.value?.id))

const profileFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(60),
}))

const { handleSubmit, setValues } = useForm({
  validationSchema: profileFormSchema,
  initialValues: { name: currentUser.value?.name ?? '' },
})

watch(() => currentUser.value?.name, (name) => {
  if (name)
    setValues({ name })
}, { immediate: true })

const onSubmit = handleSubmit(async (values) => {
  try {
    const { user } = await $fetch('/api/auth/profile', { method: 'PATCH', body: { name: values.name } })
    currentUser.value = user
    toast('Profile updated', {
      description: 'Your name has been updated.',
    })
  }
  catch (error: any) {
    toast.error('Could not update profile', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

function formatDate(value?: string) {
  if (!value)
    return '—'
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      Profile
    </h3>
    <p class="text-sm text-muted-foreground">
      This is how you appear to other staff across the platform.
    </p>
  </div>
  <Separator />
  <form class="space-y-8" @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="name">
      <FormItem>
        <FormLabel>Name</FormLabel>
        <FormControl>
          <Input type="text" placeholder="Your name" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          This is the name shown on tickets, clients, and activity you're attributed to.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex flex-col gap-1">
      <span class="text-sm text-muted-foreground">Email</span>
      <span class="text-sm">{{ currentUser?.email }}</span>
      <span class="text-xs text-muted-foreground">Your email is your login — contact an admin to change it.</span>
    </div>

    <div class="grid grid-cols-2 gap-6">
      <div class="flex flex-col gap-1">
        <span class="text-sm text-muted-foreground">Roles</span>
        <div class="flex flex-wrap gap-1 pt-0.5">
          <Badge v-for="role in currentUser?.roles" :key="role" variant="secondary" class="capitalize">
            {{ ROLE_LABELS[role] ?? role }}
          </Badge>
        </div>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-sm text-muted-foreground">Status</span>
        <Badge :variant="myRecord?.status === 'active' ? 'secondary' : 'outline'" class="capitalize w-fit">
          {{ myRecord?.status ?? '—' }}
        </Badge>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-sm text-muted-foreground">On-call</span>
        <span class="text-sm">{{ myRecord?.onCall ? 'Yes' : 'No' }}</span>
      </div>
      <div class="flex flex-col gap-1">
        <span class="text-sm text-muted-foreground">Member since</span>
        <span class="text-sm">{{ formatDate(myRecord?.createdAt) }}</span>
      </div>
    </div>

    <div class="flex justify-start">
      <Button type="submit">
        Update profile
      </Button>
    </div>
  </form>
</template>
