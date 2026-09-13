<script setup lang="ts">
import type { VendorBill } from '~/types/vendor-bill'
import VendorBillCard from '~/components/vendor-bills/VendorBillCard.vue'

const props = defineProps<{
  bill: VendorBill | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { fetchBill } = useVendorBills()

watch(() => props.bill?.id, async (id) => {
  if (id)
    await fetchBill(id)
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-xl p-6">
      <template v-if="bill">
        <SheetHeader class="p-0">
          <SheetDescription class="font-mono text-xs">
            {{ bill.id }}
          </SheetDescription>
          <SheetTitle>{{ bill.vendorName ?? 'Vendor Bill' }}</SheetTitle>
          <Button size="sm" variant="outline" class="w-fit" as-child>
            <NuxtLink :to="`/vendors?open=${bill.vendorId}`">
              <Icon name="i-lucide-external-link" class="mr-1.5 h-3.5 w-3.5" />
              View Vendor
            </NuxtLink>
          </Button>
        </SheetHeader>

        <div class="pt-4">
          <VendorBillCard :bill="bill" :show-vendor-name="false" />
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
