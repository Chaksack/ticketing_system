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

const MAX_AVATAR_SIZE = 2 * 1024 * 1024
const ALLOWED_AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

const avatarInput = ref<HTMLInputElement>()
const isUploadingAvatar = ref(false)

const initials = computed(() => currentUser.value?.name.split(' ').map(n => n[0]).join('') ?? '')

function onAvatarButtonClick() {
  avatarInput.value?.click()
}

async function onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  if (!ALLOWED_AVATAR_TYPES.includes(file.type)) {
    toast.error('Could not update photo', {
      description: 'Please choose a PNG, JPEG, WEBP, or GIF image.',
    })
    input.value = ''
    return
  }

  if (file.size > MAX_AVATAR_SIZE) {
    toast.error('Could not update photo', {
      description: 'Image must be smaller than 2MB.',
    })
    input.value = ''
    return
  }

  isUploadingAvatar.value = true
  try {
    const formData = new FormData()
    formData.append('avatar', file)

    const { user } = await $fetch('/api/auth/profile/avatar', { method: 'POST', body: formData })
    currentUser.value = user
    toast('Profile photo updated')
  }
  catch (error: any) {
    toast.error('Could not update photo', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isUploadingAvatar.value = false
    input.value = ''
  }
}

async function onRemoveAvatar() {
  try {
    const { user } = await $fetch('/api/auth/profile/avatar', { method: 'DELETE' })
    currentUser.value = user
    toast('Profile photo removed')
  }
  catch (error: any) {
    toast.error('Could not remove photo', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
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
    <div class="flex items-center gap-4">
      <Avatar class="h-16 w-16">
        <AvatarImage v-if="currentUser?.avatarUrl" :src="currentUser.avatarUrl" :alt="currentUser.name" />
        <AvatarFallback class="text-lg">
          {{ initials }}
        </AvatarFallback>
      </Avatar>
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <Button type="button" size="sm" variant="outline" :disabled="isUploadingAvatar" @click="onAvatarButtonClick">
            {{ isUploadingAvatar ? 'Uploading…' : 'Change photo' }}
          </Button>
          <Button v-if="currentUser?.avatarUrl" type="button" size="sm" variant="ghost" @click="onRemoveAvatar">
            Remove
          </Button>
        </div>
        <span class="text-xs text-muted-foreground">PNG, JPEG, WEBP, or GIF. Up to 2MB.</span>
      </div>
      <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onAvatarChange">
    </div>

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
