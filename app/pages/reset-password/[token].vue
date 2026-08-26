<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'

definePageMeta({
  layout: 'blank',
})

const route = useRoute()
const token = route.params.token as string

const { currentUser } = useAuth()

const reset = ref<{ name: string, email: string } | null>(null)
const loadError = ref<string | null>(null)
const isLoading = ref(true)

const resetUrl: string = `/api/auth/reset-password/${token}`

onMounted(async () => {
  try {
    reset.value = await $fetch<{ name: string, email: string }>(resetUrl)
  }
  catch (error: any) {
    loadError.value = error?.data?.statusMessage ?? 'This reset link is invalid or has expired.'
  }
  finally {
    isLoading.value = false
  }
})

const resetFormSchema = toTypedSchema(z.object({
  password: z.string().min(8, { message: 'Password must be at least 8 characters.' }),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match.',
  path: ['confirmPassword'],
}))

const { handleSubmit } = useForm({
  validationSchema: resetFormSchema,
  initialValues: { password: '', confirmPassword: '' },
})

const isSubmitting = ref(false)

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true
  try {
    const { user } = await $fetch('/api/auth/reset-password', {
      method: 'POST',
      body: { token, password: values.password },
    })
    currentUser.value = user
    toast('Password updated', { description: 'You\'re signed in.' })
    await navigateTo('/tickets')
  }
  catch (error: any) {
    toast.error('Could not reset your password', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div class="min-h-svh flex items-center justify-center bg-muted/30 px-4">
    <Card class="w-full max-w-sm">
      <template v-if="isLoading">
        <CardContent class="py-10 text-center text-sm text-muted-foreground">
          Checking your reset link...
        </CardContent>
      </template>

      <template v-else-if="loadError">
        <CardHeader>
          <CardTitle>Reset link invalid</CardTitle>
          <CardDescription>{{ loadError }}</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <Button as-child class="w-full">
            <NuxtLink to="/forgot-password">
              Request a new link
            </NuxtLink>
          </Button>
          <Button as-child variant="outline" class="w-full">
            <NuxtLink to="/login">
              Back to login
            </NuxtLink>
          </Button>
        </CardContent>
      </template>

      <template v-else>
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>
            Choose a new password for {{ reset?.email }}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="password">
              <FormItem>
                <FormLabel>New Password</FormLabel>
                <FormControl>
                  <Input type="password" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="confirmPassword">
              <FormItem>
                <FormLabel>Confirm Password</FormLabel>
                <FormControl>
                  <Input type="password" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <Button type="submit" class="w-full" :disabled="isSubmitting">
              Reset password & sign in
            </Button>
          </form>
        </CardContent>
      </template>
    </Card>
  </div>
</template>
