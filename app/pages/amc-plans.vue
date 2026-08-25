<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'

definePageMeta({
  middleware: 'bd',
})

const { plans, fetchPlans, addPlan, removePlan } = useAmcPlans()

onMounted(() => {
  fetchPlans()
})

const isAddOpen = ref(false)

const planFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().optional(),
  defaultDurationMonths: z.coerce.number().min(1, { message: 'Must be at least 1 month.' }),
  price: z.coerce.number().min(0).optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: planFormSchema,
  initialValues: { name: '', description: '', defaultDurationMonths: 12, price: undefined },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await addPlan(values)
    resetForm()
    isAddOpen.value = false
    toast('AMC plan created', {
      description: `"${values.name}" is now available to assign to clients.`,
    })
  }
  catch (error: any) {
    toast('Could not create plan', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

async function onDelete(id: string, name: string) {
  await removePlan(id)
  toast('Plan deleted', { description: `"${name}" was removed.` })
}

function formatPrice(price?: number) {
  return price === undefined ? '—' : `$${price.toLocaleString()}`
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          AMC Plans
        </h2>
        <p class="text-muted-foreground">
          Reusable Annual Maintenance Contract templates you can assign to a client.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Plan
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New AMC Plan</SheetTitle>
            <SheetDescription>
              Create a reusable template. You'll pick the exact start/end dates when assigning it to a client.
            </SheetDescription>
          </SheetHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Premium Annual Maintenance" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="description">
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Textarea rows="3" placeholder="What's covered under this plan..." v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-2 gap-4">
              <FormField v-slot="{ componentField }" name="defaultDurationMonths">
                <FormItem>
                  <FormLabel>Default Duration (months)</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="price">
                <FormItem>
                  <FormLabel>Price (optional)</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <SheetFooter class="p-0">
              <Button type="submit">
                Create Plan
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Default Duration</TableHead>
            <TableHead>Price</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="plans.length">
            <TableRow v-for="plan in plans" :key="plan.id">
              <TableCell class="font-medium">
                {{ plan.name }}
              </TableCell>
              <TableCell class="text-muted-foreground max-w-[320px] truncate">
                {{ plan.description || '—' }}
              </TableCell>
              <TableCell>{{ plan.defaultDurationMonths }} mo</TableCell>
              <TableCell>{{ formatPrice(plan.price) }}</TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost" class="text-destructive" @click="onDelete(plan.id, plan.name)">
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No AMC plans yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
