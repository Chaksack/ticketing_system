<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import PasswordInput from '~/components/PasswordInput.vue'

const passwordFormSchema = toTypedSchema(
  z.object({
    currentPassword: z.string().min(1, { message: 'Enter your current password.' }),
    newPassword: z.string().min(8, { message: 'New password must be at least 8 characters.' }),
    confirmPassword: z.string().min(1, { message: 'Confirm your new password.' }),
  }).refine(data => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match.',
    path: ['confirmPassword'],
  }),
)

const { handleSubmit, resetForm } = useForm({
  validationSchema: passwordFormSchema,
  initialValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
})

const isSubmitting = ref(false)

const onSubmit = handleSubmit(async (values) => {
  isSubmitting.value = true
  try {
    await $fetch('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword: values.currentPassword, newPassword: values.newPassword },
    })
    resetForm()
    toast('Password updated', {
      description: 'Use your new password next time you sign in.',
    })
  }
  catch (error: any) {
    toast.error('Could not update password', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSubmitting.value = false
  }
})
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      Account
    </h3>
    <p class="text-sm text-muted-foreground">
      Change your password. You'll stay signed in on this device.
    </p>
  </div>
  <Separator />
  <form class="space-y-6 max-w-sm" @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="currentPassword">
      <FormItem>
        <FormLabel>Current password</FormLabel>
        <FormControl>
          <PasswordInput autocomplete="current-password" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="newPassword">
      <FormItem>
        <FormLabel>New password</FormLabel>
        <FormControl>
          <PasswordInput autocomplete="new-password" v-bind="componentField" />
        </FormControl>
        <FormDescription>
          At least 8 characters.
        </FormDescription>
        <FormMessage />
      </FormItem>
    </FormField>

    <FormField v-slot="{ componentField }" name="confirmPassword">
      <FormItem>
        <FormLabel>Confirm new password</FormLabel>
        <FormControl>
          <PasswordInput autocomplete="new-password" v-bind="componentField" />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <div class="flex justify-start">
      <Button type="submit" :disabled="isSubmitting">
        Update password
      </Button>
    </div>
  </form>
</template>
