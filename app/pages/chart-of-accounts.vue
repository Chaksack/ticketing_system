<script setup lang="ts">
import type { AccountType } from '~/types/account'
import { toTypedSchema } from '@vee-validate/zod'
import { useForm } from 'vee-validate'
import { toast } from 'vue-sonner'
import * as z from 'zod'

definePageMeta({
  middleware: 'finance',
})

const { accounts, fetchAccounts, addAccount, removeAccount } = useAccounts()

onMounted(() => {
  fetchAccounts()
})

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Asset',
  liability: 'Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expense',
}

const TYPE_BADGE_CLASS: Record<AccountType, string> = {
  asset: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/30',
  liability: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  equity: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-400 dark:border-violet-500/30',
  revenue: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  expense: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
}

const searchQuery = ref('')
const filteredAccounts = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query)
    return accounts.value
  return accounts.value.filter(a => a.code.includes(query) || a.name.toLowerCase().includes(query))
})

const isAddOpen = ref(false)

const accountFormSchema = toTypedSchema(z.object({
  code: z.string().min(1, { message: 'Code is required.' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }),
  type: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parentCode: z.string().optional(),
  description: z.string().optional(),
}))

const { handleSubmit, resetForm } = useForm({
  validationSchema: accountFormSchema,
  initialValues: { code: '', name: '', type: 'asset', parentCode: '', description: '' },
})

const onSubmit = handleSubmit(async (values) => {
  try {
    await addAccount({
      code: values.code,
      name: values.name,
      type: values.type as AccountType,
      parentCode: values.parentCode || undefined,
      description: values.description || undefined,
    })
    resetForm()
    isAddOpen.value = false
    toast('Account created')
  }
  catch (error: any) {
    toast.error('Could not create account', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
})

async function onDelete(code: string, name: string) {
  try {
    await removeAccount(code)
    toast('Account deleted', { description: `"${name}" was removed.` })
  }
  catch (error: any) {
    toast.error('Could not delete account', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Chart of Accounts
        </h2>
        <p class="text-muted-foreground">
          Every account the general ledger can post to, with its live balance.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Account
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New Account</SheetTitle>
            <SheetDescription>
              Added to the chart of accounts every journal entry posts against.
            </SheetDescription>
          </SheetHeader>

          <form class="flex flex-col gap-4" @submit="onSubmit">
            <div class="grid grid-cols-2 gap-2">
              <FormField v-slot="{ componentField }" name="code">
                <FormItem>
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input type="text" placeholder="e.g. 4000" v-bind="componentField" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              </FormField>

              <FormField v-slot="{ componentField }" name="type">
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select v-bind="componentField">
                    <FormControl>
                      <SelectTrigger class="w-full">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem v-for="(label, value) in TYPE_LABELS" :key="value" :value="value">
                        {{ label }}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              </FormField>
            </div>

            <FormField v-slot="{ componentField }" name="name">
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. Service Revenue" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="parentCode">
              <FormItem>
                <FormLabel>Parent Code (optional)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. 1000" v-bind="componentField" />
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

            <SheetFooter class="p-0">
              <Button type="submit">
                Create Account
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input v-model="searchQuery" placeholder="Search accounts..." class="pl-8" />
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Balance</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="filteredAccounts.length">
            <TableRow v-for="account in filteredAccounts" :key="account.code">
              <TableCell class="font-mono text-xs font-medium">
                {{ account.code }}
              </TableCell>
              <TableCell class="font-medium">
                {{ account.name }}
              </TableCell>
              <TableCell>
                <Badge variant="outline" :class="TYPE_BADGE_CLASS[account.type]">
                  {{ TYPE_LABELS[account.type] }}
                </Badge>
              </TableCell>
              <TableCell class="tabular-nums">
                {{ account.balance.toLocaleString() }}
              </TableCell>
              <TableCell>
                <Button size="icon-sm" variant="ghost" class="text-destructive" @click="onDelete(account.code, account.name)">
                  <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No accounts match your search.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
