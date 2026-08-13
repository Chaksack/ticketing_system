<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { Loader2 } from 'lucide-vue-next'
import { useForm } from 'vee-validate'
import * as z from 'zod'

const isLoading = ref(false)
const isSubmitted = ref(false)

const schema = toTypedSchema(z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
}))

const { handleSubmit } = useForm({
  validationSchema: schema,
  initialValues: { email: '' },
})

const onSubmit = handleSubmit(async (values) => {
  isLoading.value = true

  try {
    await $fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: values.email },
    })
  }
  finally {
    isLoading.value = false
    isSubmitted.value = true
  }
})
</script>

<template>
  <div v-if="isSubmitted" class="text-center text-sm text-muted-foreground">
    If an account exists for that email, we've sent a link to reset your password. It expires in 1 hour.
  </div>

  <form v-else @submit="onSubmit">
    <FormField v-slot="{ componentField }" name="email">
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input
            type="email"
            placeholder="name@example.com"
            auto-capitalize="none"
            auto-complete="email"
            auto-correct="off"
            :disabled="isLoading"
            v-bind="componentField"
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    </FormField>

    <Button type="submit" class="mt-4 w-full" :disabled="isLoading">
      <Loader2 v-if="isLoading" class="mr-2 h-4 w-4 animate-spin" />
      Submit
    </Button>
  </form>
</template>

<style scoped>

</style>
