<script setup lang="ts">
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'

definePageMeta({
  middleware: 'admin',
})

const { products, fetchProducts, addProduct, removeProduct } = useProducts()

onMounted(() => {
  fetchProducts()
})

const searchQuery = ref('')
const filteredProducts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return products.value
  return products.value.filter(p => p.name.toLowerCase().includes(query))
})

const isAddOpen = ref(false)

const productFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  description: z.string().optional(),
  unitPrice: z.string().min(1, { message: 'Unit price is required.' }),
  currency: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: productFormSchema,
  initialValues: { name: '', description: '', unitPrice: '', currency: 'GHS' },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await addProduct({
      name: values.name,
      description: values.description || undefined,
      unitPrice: Number(values.unitPrice),
      currency: values.currency || 'GHS',
    })
    resetForm()
    isAddOpen.value = false
    toast('Product added')
  }
  catch (error: any) {
    toast.error('Could not add product', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

async function onDelete(id: string, name: string) {
  await removeProduct(id)
  toast('Product deleted', { description: `"${name}" was removed.` })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Products
        </h2>
        <p class="text-muted-foreground">
          The shared catalog used for AMC contract line items and quotes.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Product
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New Product</SheetTitle>
            <SheetDescription>
              Added to the shared catalog for line items and quotes.
            </SheetDescription>
          </SheetHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Fire Alarm Panel" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="description">
              <FormItem>
                <FormLabel>Description (optional)</FormLabel>
                <FormControl>
                  <Textarea rows="2" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-2 gap-2">
              <FormField v-slot="{ componentField }" name="unitPrice">
                <FormItem>
                  <FormLabel>Unit Price</FormLabel>
                  <FormControl>
                    <Input type="number" min="0" step="0.01" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="currency">
                <FormItem>
                  <FormLabel>Currency</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="GHS" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <SheetFooter class="p-0">
              <Button type="submit">
                Add Product
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input v-model="searchQuery" placeholder="Search products..." class="pl-8" />
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Unit Price</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredProducts.length">
            <TableRow v-for="product in filteredProducts" :key="product.id">
              <TableCell class="font-medium">
                {{ product.name }}
              </TableCell>
              <TableCell class="text-muted-foreground text-sm">
                {{ product.description }}
              </TableCell>
              <TableCell class="tabular-nums">
                {{ product.unitPrice.toLocaleString() }} {{ product.currency }}
              </TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost" class="text-destructive" @click="onDelete(product.id, product.name)">
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="4" class="h-24 text-center">
              No products match your search.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
