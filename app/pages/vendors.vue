<script setup lang="ts">
import type { Vendor } from '~/types/vendor'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'
import VendorDetailSheet from '~/components/vendors/VendorDetailSheet.vue'

definePageMeta({
  middleware: 'finance',
})

const { vendors, fetchVendors, addVendor } = useVendors()
const route = useRoute()

onMounted(() => {
  fetchVendors()
})

const searchQuery = ref('')
const filteredVendors = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return vendors.value
  return vendors.value.filter(v => v.name.toLowerCase().includes(query) || v.contactName?.toLowerCase().includes(query))
})

const isDetailOpen = ref(false)
const selectedVendorId = ref<string | null>(null)
const selectedVendor = computed(() => vendors.value.find(v => v.id === selectedVendorId.value) ?? null)

function openVendor(vendor: Vendor) {
  selectedVendorId.value = vendor.id
  isDetailOpen.value = true
}

watch(() => route.query.open, (openId) => {
  if (typeof openId === 'string')
    openVendor({ id: openId } as Vendor)
}, { immediate: true })

const isAddOpen = ref(false)

const vendorFormSchema = toTypedSchema(z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  contactName: z.string().optional(),
  contactEmail: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: vendorFormSchema,
  initialValues: { name: '', contactName: '', contactEmail: '', contactPhone: '', address: '' },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await addVendor({
      name: values.name,
      contactName: values.contactName || undefined,
      contactEmail: values.contactEmail || undefined,
      contactPhone: values.contactPhone || undefined,
      address: values.address || undefined,
    })
    resetForm()
    isAddOpen.value = false
    toast('Vendor created')
  }
  catch (error: any) {
    toast.error('Could not create vendor', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Vendors
        </h2>
        <p class="text-muted-foreground">
          Everyone the business owes money to — record bills and payments from a vendor's own page.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Vendor
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New Vendor</SheetTitle>
            <SheetDescription>
              Added to your vendor list so you can start recording bills against them.
            </SheetDescription>
          </SheetHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Acme Supplies Ltd" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <div class="grid grid-cols-2 gap-2">
              <FormField v-slot="{ componentField }" name="contactName">
                <FormItem>
                  <FormLabel>Contact Name (optional)</FormLabel>
                  <FormControl>
                    <Input type="text" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="contactEmail">
                <FormItem>
                  <FormLabel>Contact Email (optional)</FormLabel>
                  <FormControl>
                    <Input type="email" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <div class="grid grid-cols-2 gap-2">
              <FormField v-slot="{ componentField }" name="contactPhone">
                <FormItem>
                  <FormLabel>Contact Phone (optional)</FormLabel>
                  <FormControl>
                    <Input type="text" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="address">
                <FormItem>
                  <FormLabel>Address (optional)</FormLabel>
                  <FormControl>
                    <Input type="text" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <SheetFooter class="p-0">
              <Button type="submit">
                Create Vendor
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input v-model="searchQuery" placeholder="Search vendors..." class="pl-8" />
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredVendors.length">
            <TableRow v-for="vendor in filteredVendors" :key="vendor.id" class="cursor-pointer" @click="openVendor(vendor)">
              <TableCell class="font-medium">
                {{ vendor.name }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ vendor.contactName || '—' }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ vendor.contactEmail || '—' }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ vendor.contactPhone || '—' }}
              </TableCell>
              <TableCell>
                <Badge variant="outline" :class="vendor.isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' : ''">
                  {{ vendor.isActive ? 'Active' : 'Inactive' }}
                </Badge>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No vendors match your search.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <VendorDetailSheet v-model:open="isDetailOpen" :vendor="selectedVendor" />
  </div>
</template>
