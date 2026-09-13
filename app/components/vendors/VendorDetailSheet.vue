<script setup lang="ts">
import type { Vendor } from '~/types/vendor'
import { toast } from 'vue-sonner'
import VendorBillCard from '~/components/vendor-bills/VendorBillCard.vue'

const props = defineProps<{
  vendor: Vendor | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { updateVendor } = useVendors()
const { bills, fetchBillsForVendor, addBill } = useVendorBills()
const { accounts, fetchAccounts } = useAccounts()

onMounted(() => {
  if (!accounts.value.length)
    fetchAccounts()
})

const expenseAccounts = computed(() => accounts.value.filter(a => a.type === 'expense'))
const vendorBills = computed(() => props.vendor ? bills.value.filter(b => b.vendorId === props.vendor!.id) : [])

watch(() => props.vendor?.id, async (id) => {
  if (id)
    await fetchBillsForVendor(id)
})

const contactName = ref('')
const contactEmail = ref('')
const contactPhone = ref('')
const address = ref('')
const notes = ref('')

watch(() => props.vendor, (vendor) => {
  contactName.value = vendor?.contactName ?? ''
  contactEmail.value = vendor?.contactEmail ?? ''
  contactPhone.value = vendor?.contactPhone ?? ''
  address.value = vendor?.address ?? ''
  notes.value = vendor?.notes ?? ''
}, { immediate: true })

async function onSaveContact() {
  if (!props.vendor)
    return
  try {
    await updateVendor(props.vendor.id, {
      contactName: contactName.value.trim() || undefined,
      contactEmail: contactEmail.value.trim() || undefined,
      contactPhone: contactPhone.value.trim() || undefined,
      address: address.value.trim() || undefined,
      notes: notes.value.trim() || undefined,
    })
    toast('Vendor updated')
  }
  catch (error: any) {
    toast.error('Could not update vendor', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

const isBillFormOpen = ref(false)
const newBillLineItems = ref<{ description: string, quantity: number, unitPrice: number }[]>([])
const newLineDescription = ref('')
const newLineQuantity = ref('1')
const newLineUnitPrice = ref('')
const newBillCurrency = ref('GHS')
const newBillTaxRate = ref('0')
const newBillDate = ref(new Date().toISOString().slice(0, 10))
const newBillDueAt = ref('')
const newBillReference = ref('')
const newBillExpenseAccountCode = ref('')

const newBillSubtotal = computed(() => newBillLineItems.value.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
const newBillTotal = computed(() => {
  const taxAmount = newBillSubtotal.value * (Number(newBillTaxRate.value || 0) / 100)
  return Math.max(newBillSubtotal.value + taxAmount, 0)
})

function onAddBillLine() {
  if (!newLineDescription.value.trim() || !newLineUnitPrice.value.trim())
    return
  newBillLineItems.value = [...newBillLineItems.value, {
    description: newLineDescription.value.trim(),
    quantity: Number(newLineQuantity.value) > 0 ? Number(newLineQuantity.value) : 1,
    unitPrice: Number(newLineUnitPrice.value),
  }]
  newLineDescription.value = ''
  newLineQuantity.value = '1'
  newLineUnitPrice.value = ''
}

function onRemoveBillLine(index: number) {
  newBillLineItems.value = newBillLineItems.value.filter((_, i) => i !== index)
}

async function onCreateBill() {
  if (!props.vendor || !newBillLineItems.value.length || !newBillExpenseAccountCode.value)
    return

  try {
    await addBill(props.vendor.id, {
      lineItems: newBillLineItems.value,
      expenseAccountCode: newBillExpenseAccountCode.value,
      currency: newBillCurrency.value.trim() || 'GHS',
      taxRate: Number(newBillTaxRate.value || 0),
      billDate: newBillDate.value || undefined,
      dueAt: newBillDueAt.value || undefined,
      reference: newBillReference.value.trim() || undefined,
    })
    newBillLineItems.value = []
    newBillTaxRate.value = '0'
    newBillDueAt.value = ''
    newBillReference.value = ''
    newBillExpenseAccountCode.value = ''
    isBillFormOpen.value = false
    toast('Vendor bill created')
  }
  catch (error: any) {
    toast.error('Could not create vendor bill', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-2xl p-0">
      <template v-if="vendor">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ vendor.id }}
          </SheetDescription>
          <SheetTitle>{{ vendor.name }}</SheetTitle>
          <Badge variant="outline" class="w-fit" :class="vendor.isActive ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' : ''">
            {{ vendor.isActive ? 'Active' : 'Inactive' }}
          </Badge>
        </SheetHeader>

        <ScrollArea class="flex-1 min-h-0">
          <div class="flex flex-col gap-6 px-6 pt-4 pb-6">
            <div class="flex flex-col gap-2">
              <h4 class="text-sm font-medium">
                Contact
              </h4>
              <div class="grid grid-cols-2 gap-2">
                <Input v-model="contactName" placeholder="Contact name" class="h-8 text-xs" />
                <Input v-model="contactEmail" placeholder="Contact email" class="h-8 text-xs" />
                <Input v-model="contactPhone" placeholder="Contact phone" class="h-8 text-xs" />
                <Input v-model="address" placeholder="Address" class="h-8 text-xs" />
              </div>
              <Textarea v-model="notes" rows="2" placeholder="Notes (optional)" class="text-xs" />
              <div class="flex justify-end">
                <Button size="sm" variant="outline" @click="onSaveContact">
                  Save
                </Button>
              </div>
            </div>

            <Separator />

            <div class="flex flex-col gap-3">
              <h4 class="text-sm font-medium flex items-center justify-between">
                <span>Bills</span>
                <Button size="sm" variant="outline" @click="isBillFormOpen = !isBillFormOpen">
                  <Icon name="i-lucide-plus" class="mr-1.5 h-3.5 w-3.5" />
                  New Bill
                </Button>
              </h4>

              <div v-if="isBillFormOpen" class="flex flex-col gap-2 rounded-md border p-2">
                <div v-for="(line, index) in newBillLineItems" :key="index" class="flex items-center gap-2 rounded-md border p-1.5 text-xs">
                  <span class="flex-1 truncate">{{ line.description }}</span>
                  <span class="shrink-0 text-muted-foreground">{{ line.quantity }} × {{ line.unitPrice.toLocaleString() }}</span>
                  <span class="shrink-0 font-medium tabular-nums">{{ (line.quantity * line.unitPrice).toLocaleString() }}</span>
                  <Button size="icon-sm" variant="ghost" class="size-5 shrink-0" @click="onRemoveBillLine(index)">
                    <Icon name="i-lucide-x" class="size-3" />
                  </Button>
                </div>

                <div class="grid grid-cols-3 gap-2">
                  <Input v-model="newLineDescription" placeholder="Line description" class="h-8 text-xs" />
                  <Input v-model="newLineQuantity" type="number" min="1" placeholder="Qty" class="h-8 text-xs" />
                  <Input v-model="newLineUnitPrice" type="number" min="0" step="0.01" placeholder="Unit price" class="h-8 text-xs" />
                </div>
                <div class="flex justify-end">
                  <Button size="sm" variant="outline" @click="onAddBillLine">
                    <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
                    Add Line
                  </Button>
                </div>

                <Select v-model="newBillExpenseAccountCode">
                  <SelectTrigger class="h-8 text-xs">
                    <SelectValue placeholder="Expense account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem v-for="account in expenseAccounts" :key="account.code" :value="account.code">
                      {{ account.code }} — {{ account.name }}
                    </SelectItem>
                  </SelectContent>
                </Select>

                <div class="grid grid-cols-4 gap-2">
                  <Input v-model="newBillCurrency" placeholder="Currency" class="h-8 text-xs" />
                  <Input v-model="newBillTaxRate" type="number" min="0" step="0.1" placeholder="Tax %" class="h-8 text-xs" />
                  <Input v-model="newBillDate" type="date" class="h-8 text-xs" />
                  <Input v-model="newBillDueAt" type="date" class="h-8 text-xs" placeholder="Due date" />
                </div>
                <Input v-model="newBillReference" placeholder="Vendor's reference (optional)" class="h-8 text-xs" />

                <div class="flex items-center justify-between pt-1">
                  <span class="text-xs text-muted-foreground">Total: {{ newBillTotal.toLocaleString() }} {{ newBillCurrency }}</span>
                  <Button size="sm" :disabled="!newBillLineItems.length || !newBillExpenseAccountCode" @click="onCreateBill">
                    Create Bill
                  </Button>
                </div>
              </div>

              <p v-if="!vendorBills.length" class="text-sm text-muted-foreground">
                No bills yet.
              </p>
              <VendorBillCard v-for="bill in vendorBills" :key="bill.id" :bill="bill" />
            </div>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
