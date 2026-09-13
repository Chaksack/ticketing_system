<script setup lang="ts">
import type { Invoice } from '~/types/invoice'
import InvoiceCard from '~/components/invoices/InvoiceCard.vue'

const props = defineProps<{
  invoice: Invoice | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { fetchInvoice } = useInvoices()

watch(() => props.invoice?.id, async (id) => {
  if (id)
    await fetchInvoice(id)
})
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-xl p-6">
      <template v-if="invoice">
        <SheetHeader class="p-0">
          <SheetDescription class="font-mono text-xs">
            {{ invoice.id }}
          </SheetDescription>
          <SheetTitle>{{ invoice.clientName ?? 'Invoice' }}</SheetTitle>
          <Button size="sm" variant="outline" class="w-fit" as-child>
            <NuxtLink :to="`/clients?open=${invoice.clientId}`">
              <Icon name="i-lucide-external-link" class="mr-1.5 h-3.5 w-3.5" />
              View Client
            </NuxtLink>
          </Button>
        </SheetHeader>

        <div class="pt-4">
          <InvoiceCard :invoice="invoice" :client-id="invoice.clientId" :show-client-name="false" />
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
