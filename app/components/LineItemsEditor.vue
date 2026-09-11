<script setup lang="ts">
import type { Product } from '~/types/product'

export interface DraftLineItem {
  productId?: string
  productName: string
  unitPrice: number
  currency: string
  quantity: number
}

export interface DisplayLineItem {
  id?: string
  productName: string
  unitPrice: number
  currency: string
  quantity: number
}

const props = defineProps<{
  lineItems: DisplayLineItem[]
  productCatalog: Product[]
  defaultCurrency?: string
}>()

const emit = defineEmits<{
  add: [item: DraftLineItem]
  remove: [item: DisplayLineItem, index: number]
}>()

const selectedProductId = ref<string>('')
const customName = ref('')
const customPrice = ref('')
const quantity = ref('1')

const total = computed(() => props.lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))

function addRow() {
  const qty = Number(quantity.value) > 0 ? Number(quantity.value) : 1

  if (selectedProductId.value) {
    const product = props.productCatalog.find(p => p.id === selectedProductId.value)
    if (!product)
      return
    emit('add', {
      productId: product.id,
      productName: product.name,
      unitPrice: product.unitPrice,
      currency: product.currency,
      quantity: qty,
    })
  }
  else {
    if (!customName.value.trim() || !customPrice.value.trim())
      return
    emit('add', {
      productName: customName.value.trim(),
      unitPrice: Number(customPrice.value),
      currency: props.defaultCurrency ?? 'GHS',
      quantity: qty,
    })
  }

  selectedProductId.value = ''
  customName.value = ''
  customPrice.value = ''
  quantity.value = '1'
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div v-for="(item, index) in lineItems" :key="item.id ?? index" class="flex items-center gap-2 rounded-md border p-2 text-sm">
      <span class="flex-1 truncate">{{ item.productName }}</span>
      <span class="shrink-0 text-xs text-muted-foreground">{{ item.quantity }} × {{ item.unitPrice.toLocaleString() }} {{ item.currency }}</span>
      <span class="shrink-0 font-medium tabular-nums">{{ (item.unitPrice * item.quantity).toLocaleString() }}</span>
      <Button size="icon-sm" variant="ghost" class="size-6 shrink-0 text-muted-foreground" @click="emit('remove', item, index)">
        <Icon name="i-lucide-x" class="size-3" />
      </Button>
    </div>
    <p v-if="!lineItems.length" class="text-sm text-muted-foreground">
      No line items yet.
    </p>

    <div class="flex flex-col gap-2 rounded-md border p-2">
      <Select v-model="selectedProductId">
        <SelectTrigger class="w-full">
          <SelectValue placeholder="Pick from catalog, or leave blank for a custom line" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="product in productCatalog" :key="product.id" :value="product.id">
            {{ product.name }} — {{ product.unitPrice.toLocaleString() }} {{ product.currency }}
          </SelectItem>
        </SelectContent>
      </Select>
      <div v-if="!selectedProductId" class="grid grid-cols-2 gap-2">
        <Input v-model="customName" placeholder="Custom item name" class="h-8 text-xs" />
        <Input v-model="customPrice" type="number" min="0" step="0.01" placeholder="Unit price" class="h-8 text-xs" />
      </div>
      <div class="flex items-center justify-between gap-2">
        <Input v-model="quantity" type="number" min="1" class="h-8 w-20 text-xs" />
        <Button size="sm" variant="outline" @click="addRow">
          <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
          Add Line
        </Button>
      </div>
    </div>

    <div class="flex justify-end text-sm font-medium">
      Total: {{ total.toLocaleString() }}
    </div>
  </div>
</template>
