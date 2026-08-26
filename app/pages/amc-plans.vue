<script setup lang="ts">
import type { AmcPlan } from '~/types/amc'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import { currencies } from '~/components/projects/data'

definePageMeta({
  middleware: 'bd',
})

const { plans, fetchPlans, addPlan, updatePlan, removePlan } = useAmcPlans()

onMounted(() => {
  fetchPlans()
})

const searchQuery = ref('')
const filteredPlans = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return plans.value
  return plans.value.filter(p => p.name.toLowerCase().includes(query) || (p.description ?? '').toLowerCase().includes(query))
})

const isAddOpen = ref(false)

const planFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().optional(),
  defaultDurationMonths: z.coerce.number().min(1, { message: 'Must be at least 1 month.' }),
  price: z.coerce.number().min(0).optional(),
  currency: z.string().min(1),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: planFormSchema,
  initialValues: { name: '', description: '', defaultDurationMonths: 12, price: undefined, currency: 'GHS' },
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
    toast.error('Could not create plan', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

const isEditOpen = ref(false)
const editingPlan = ref<AmcPlan | null>(null)
const editDraft = reactive({ name: '', description: '', defaultDurationMonths: 12, price: undefined as number | undefined, currency: 'GHS' })

function openEdit(plan: AmcPlan) {
  editingPlan.value = plan
  editDraft.name = plan.name
  editDraft.description = plan.description ?? ''
  editDraft.defaultDurationMonths = plan.defaultDurationMonths
  editDraft.price = plan.price
  editDraft.currency = plan.currency
  isEditOpen.value = true
}

async function onSaveEdit() {
  if (!editingPlan.value || !editDraft.name.trim())
    return

  try {
    await updatePlan(editingPlan.value.id, {
      name: editDraft.name.trim(),
      description: editDraft.description.trim() || undefined,
      defaultDurationMonths: editDraft.defaultDurationMonths,
      price: editDraft.price,
      currency: editDraft.currency,
    })
    isEditOpen.value = false
    toast('Plan updated')
  }
  catch (error: any) {
    toast.error('Could not update plan', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

async function onDelete(id: string, name: string) {
  await removePlan(id)
  toast('Plan deleted', { description: `"${name}" was removed.` })
}

function currencySymbol(code: string) {
  return currencies.find(c => c.value === code)?.symbol ?? code
}

function formatPrice(price: number | undefined, currency: string) {
  return price === undefined ? '—' : `${currencySymbol(currency)}${price.toLocaleString()}`
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

            <FormField v-slot="{ componentField }" name="defaultDurationMonths">
              <FormItem>
                <FormLabel>Default Duration (months)</FormLabel>
                <FormControl>
                  <Input type="number" min="1" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

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
                      <SelectItem v-for="option in currencies" :key="option.value" :value="option.value">
                        {{ option.label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
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

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input v-model="searchQuery" placeholder="Search plans..." class="pl-8" />
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Default Duration</TableHead>
            <TableHead>Price</TableHead>
            <TableHead class="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredPlans.length">
            <TableRow v-for="plan in filteredPlans" :key="plan.id">
              <TableCell class="font-medium">
                {{ plan.name }}
              </TableCell>
              <TableCell class="text-muted-foreground max-w-[320px] truncate">
                {{ plan.description || '—' }}
              </TableCell>
              <TableCell>{{ plan.defaultDurationMonths }} mo</TableCell>
              <TableCell>{{ formatPrice(plan.price, plan.currency) }}</TableCell>
              <TableCell class="flex items-center gap-0.5 justify-end">
                <Button size="icon-sm" variant="ghost" @click="openEdit(plan)">
                  <Icon name="i-lucide-pencil" class="h-4 w-4" />
                </Button>
                <Button size="icon-sm" variant="ghost" class="text-destructive" @click="onDelete(plan.id, plan.name)">
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No AMC plans match your search.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Sheet v-model:open="isEditOpen">
      <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
        <SheetHeader class="p-0">
          <SheetTitle>Edit AMC Plan</SheetTitle>
          <SheetDescription class="sr-only">
            Edit AMC Plan
          </SheetDescription>
        </SheetHeader>

        <div class="flex flex-col gap-4 py-4">
          <div class="flex flex-col gap-1.5">
            <Label>Name</Label>
            <Input v-model="editDraft.name" placeholder="Plan name" />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Description</Label>
            <Textarea v-model="editDraft.description" rows="3" placeholder="What's covered under this plan..." />
          </div>
          <div class="flex flex-col gap-1.5">
            <Label>Default Duration (months)</Label>
            <Input v-model.number="editDraft.defaultDurationMonths" type="number" min="1" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="flex flex-col gap-1.5">
              <Label>Currency</Label>
              <Select v-model="editDraft.currency">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="option in currencies" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Price</Label>
              <Input v-model.number="editDraft.price" type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
          </div>
        </div>

        <SheetFooter class="p-0">
          <Button variant="secondary" @click="isEditOpen = false">
            Cancel
          </Button>
          <Button @click="onSaveEdit">
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  </div>
</template>
