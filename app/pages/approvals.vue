<script setup lang="ts">
import { toast } from 'vue-sonner'

definePageMeta({
  middleware: 'finance',
})

const { approvals, fetchApprovals, approve, reject } = useApprovals()

onMounted(() => {
  fetchApprovals()
})

const pending = computed(() => approvals.value.filter(a => a.status === 'pending'))
const decided = computed(() => approvals.value.filter(a => a.status !== 'pending'))

const notesDraft = reactive<Record<string, string>>({})
const isDeciding = ref<string | null>(null)

async function onApprove(id: string) {
  isDeciding.value = id
  try {
    await approve(id, notesDraft[id]?.trim() || undefined)
    toast('Approved')
  }
  catch (error: any) {
    toast.error('Could not approve', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isDeciding.value = null
  }
}

async function onReject(id: string) {
  isDeciding.value = id
  try {
    await reject(id, notesDraft[id]?.trim() || undefined)
    toast('Rejected')
  }
  catch (error: any) {
    toast.error('Could not reject', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isDeciding.value = null
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-6">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        Approvals
      </h2>
      <p class="text-muted-foreground">
        Requests that need sign-off before they take effect — large discounts today, more kinds later.
      </p>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium">
        Pending
      </h3>
      <p v-if="!pending.length" class="text-sm text-muted-foreground">
        Nothing waiting on you.
      </p>
      <div v-for="request in pending" :key="request.id" class="flex flex-col gap-2 rounded-md border p-3">
        <div class="flex items-center justify-between gap-2">
          <span class="font-medium text-sm">{{ request.subjectLabel }}</span>
          <Badge variant="outline">
            {{ request.type }}
          </Badge>
        </div>
        <span class="text-xs text-muted-foreground">
          Requested by {{ request.requestedByName || 'Unknown' }} · {{ formatDateTime(request.requestedAt) }}
        </span>
        <Input v-model="notesDraft[request.id]" placeholder="Decision notes (optional)" class="h-8 text-xs" />
        <div class="flex justify-end gap-2">
          <Button size="sm" variant="outline" class="text-destructive" :disabled="isDeciding === request.id" @click="onReject(request.id)">
            Reject
          </Button>
          <Button size="sm" :disabled="isDeciding === request.id" @click="onApprove(request.id)">
            Approve
          </Button>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-3">
      <h3 class="text-sm font-medium">
        Decided
      </h3>
      <div class="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Request</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Decided By</TableHead>
              <TableHead>Decided At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="decided.length">
              <TableRow v-for="request in decided" :key="request.id">
                <TableCell class="text-sm">
                  {{ request.subjectLabel }}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" :class="request.status === 'approved' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'">
                    {{ request.status }}
                  </Badge>
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ request.requestedByName || '—' }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ request.decidedByName || '—' }}
                </TableCell>
                <TableCell class="text-sm text-muted-foreground">
                  {{ request.decidedAt ? formatDateTime(request.decidedAt) : '—' }}
                </TableCell>
              </TableRow>
            </template>
            <TableRow v-else>
              <TableCell :colspan="5" class="h-20 text-center text-muted-foreground">
                No decided requests yet.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  </div>
</template>
