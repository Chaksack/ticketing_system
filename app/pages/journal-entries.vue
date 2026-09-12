<script setup lang="ts">
import type { NewJournalLine } from '~/composables/useJournalEntries'
import { toast } from 'vue-sonner'

definePageMeta({
  middleware: 'finance',
})

const { entries, fetchEntries, addEntry, removeEntry } = useJournalEntries()
const { accounts, fetchAccounts } = useAccounts()

onMounted(() => {
  fetchEntries()
  fetchAccounts()
})

function accountLabel(code: string) {
  const account = accounts.value.find(a => a.code === code)
  return account ? `${account.code} — ${account.name}` : code
}

const isFormOpen = ref(false)
const entryDate = ref(new Date().toISOString().slice(0, 10))
const memo = ref('')
const lines = ref<NewJournalLine[]>([{ accountCode: '' }, { accountCode: '' }])

const totalDebit = computed(() => lines.value.reduce((sum, line) => sum + (line.debit ?? 0), 0))
const totalCredit = computed(() => lines.value.reduce((sum, line) => sum + (line.credit ?? 0), 0))
const isBalanced = computed(() => lines.value.length > 0 && totalDebit.value > 0 && Math.round(totalDebit.value * 100) === Math.round(totalCredit.value * 100))

function addLine() {
  lines.value = [...lines.value, { accountCode: '' }]
}

function removeLine(index: number) {
  lines.value = lines.value.filter((_, i) => i !== index)
}

function setDebit(index: number, value: string) {
  lines.value[index]!.debit = value ? Number(value) : undefined
  lines.value[index]!.credit = undefined
}

function setCredit(index: number, value: string) {
  lines.value[index]!.credit = value ? Number(value) : undefined
  lines.value[index]!.debit = undefined
}

const isSaving = ref(false)

async function onCreateEntry() {
  if (!isBalanced.value)
    return

  const validLines = lines.value.filter(line => line.accountCode && (line.debit || line.credit))
  if (validLines.length < 2) {
    toast.error('An entry needs at least two lines')
    return
  }

  isSaving.value = true
  try {
    await addEntry({ entryDate: entryDate.value, memo: memo.value.trim() || undefined, lines: validLines })
    memo.value = ''
    lines.value = [{ accountCode: '' }, { accountCode: '' }]
    isFormOpen.value = false
    toast('Journal entry posted')
  }
  catch (error: any) {
    toast.error('Could not post entry', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

async function onDeleteEntry(id: string) {
  try {
    await removeEntry(id)
    toast('Journal entry removed')
  }
  catch (error: any) {
    toast.error('Could not remove entry', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

const expandedId = ref<string | null>(null)

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          Journal Entries
        </h2>
        <p class="text-muted-foreground">
          The general ledger — every posted debit and credit, manual or automatic.
        </p>
      </div>
      <Button @click="isFormOpen = !isFormOpen">
        <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
        New Entry
      </Button>
    </div>

    <div v-if="isFormOpen" class="flex flex-col gap-3 rounded-md border p-4">
      <div class="grid grid-cols-2 gap-2">
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Date</Label>
          <Input v-model="entryDate" type="date" class="h-8 text-xs" />
        </div>
        <div class="flex flex-col gap-1.5">
          <Label class="text-xs text-muted-foreground">Memo (optional)</Label>
          <Input v-model="memo" placeholder="What is this entry for?" class="h-8 text-xs" />
        </div>
      </div>

      <div class="flex flex-col gap-2">
        <div v-for="(line, index) in lines" :key="index" class="grid grid-cols-[1fr_auto_auto_auto] items-center gap-2">
          <Select v-model="line.accountCode">
            <SelectTrigger class="h-8 text-xs">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="account in accounts" :key="account.code" :value="account.code">
                {{ account.code }} — {{ account.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number" min="0" step="0.01" placeholder="Debit" class="h-8 w-28 text-xs"
            :model-value="line.debit ?? ''"
            @update:model-value="(v) => setDebit(index, String(v))"
          />
          <Input
            type="number" min="0" step="0.01" placeholder="Credit" class="h-8 w-28 text-xs"
            :model-value="line.credit ?? ''"
            @update:model-value="(v) => setCredit(index, String(v))"
          />
          <Button size="icon-sm" variant="ghost" class="shrink-0" :disabled="lines.length <= 2" @click="removeLine(index)">
            <Icon name="i-lucide-x" class="size-3.5" />
          </Button>
        </div>
        <div class="flex justify-start">
          <Button size="sm" variant="outline" @click="addLine">
            <Icon name="i-lucide-plus" class="mr-1 size-3.5" />
            Add Line
          </Button>
        </div>
      </div>

      <div class="flex items-center justify-between border-t pt-3">
        <span class="text-xs" :class="isBalanced ? 'text-muted-foreground' : 'text-destructive'">
          Debits {{ totalDebit.toLocaleString() }} · Credits {{ totalCredit.toLocaleString() }}
          <span v-if="!isBalanced"> — not balanced</span>
        </span>
        <Button size="sm" :disabled="!isBalanced || isSaving" @click="onCreateEntry">
          Post Entry
        </Button>
      </div>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Memo</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Total</TableHead>
            <TableHead class="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="entries.length">
            <template v-for="entry in entries" :key="entry.id">
              <TableRow class="cursor-pointer" @click="expandedId = expandedId === entry.id ? null : entry.id">
                <TableCell class="text-sm">
                  {{ formatDate(entry.entryDate) }}
                </TableCell>
                <TableCell class="text-sm">
                  {{ entry.memo || '—' }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" class="capitalize">
                    {{ entry.source }}
                  </Badge>
                </TableCell>
                <TableCell class="tabular-nums">
                  {{ entry.totalDebit.toLocaleString() }}
                </TableCell>
                <TableCell>
                  <Button
                    v-if="entry.source === 'manual'" size="icon-sm" variant="ghost" class="text-destructive"
                    @click.stop="onDeleteEntry(entry.id)"
                  >
                    <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
              <TableRow v-if="expandedId === entry.id">
                <TableCell :colspan="5" class="bg-muted/30">
                  <div class="flex flex-col gap-1 py-1 text-xs">
                    <div v-for="line in entry.lines" :key="line.id" class="flex items-center justify-between">
                      <span>{{ accountLabel(line.accountCode) }}</span>
                      <span class="tabular-nums text-muted-foreground">
                        <span v-if="line.debit">Dr {{ line.debit.toLocaleString() }}</span>
                        <span v-if="line.credit">Cr {{ line.credit.toLocaleString() }}</span>
                      </span>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
            </template>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No journal entries posted yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
