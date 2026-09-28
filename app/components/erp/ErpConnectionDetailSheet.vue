<script setup lang="ts">
import type { ErpConnection } from '~/types/erp-connection'
import { toast } from 'vue-sonner'

const props = defineProps<{
  connection: ErpConnection | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { records, testConnection, fetchFromConnection, fetchRecords } = useErpConnections()

watch(() => props.connection?.id, (id) => {
  if (id)
    fetchRecords(id)
})

const isTesting = ref(false)
const testResult = ref<{ ok: boolean, status: number } | null>(null)

async function onTest() {
  if (!props.connection)
    return
  isTesting.value = true
  try {
    testResult.value = await testConnection(props.connection.id)
    toast(testResult.value.ok ? 'Connection OK' : 'Connection failed', {
      description: `HTTP ${testResult.value.status}`,
    })
  }
  catch (error: any) {
    toast.error('Could not test connection', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isTesting.value = false
  }
}

const fetchPath = ref('')
const isFetching = ref(false)
const lastFetchResult = ref<unknown>(null)

async function onFetch() {
  if (!props.connection || !fetchPath.value.trim())
    return
  isFetching.value = true
  try {
    lastFetchResult.value = await fetchFromConnection(props.connection.id, fetchPath.value.trim())
    toast('Fetched', { description: `Stored as a new import record.` })
  }
  catch (error: any) {
    toast.error('Could not fetch', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isFetching.value = false
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function preview(json: unknown) {
  const text = JSON.stringify(json, null, 2)
  return text.length > 500 ? `${text.slice(0, 500)}…` : text
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-xl overflow-y-auto p-6">
      <template v-if="connection">
        <SheetHeader class="p-0">
          <SheetDescription class="font-mono text-xs">
            {{ connection.id }}
          </SheetDescription>
          <SheetTitle>{{ connection.name }}</SheetTitle>
          <p class="text-xs text-muted-foreground">
            {{ connection.baseUrl }}
          </p>
        </SheetHeader>

        <div class="flex flex-col gap-6 py-4">
          <div class="flex flex-col gap-2">
            <h4 class="text-sm font-medium">
              Test Connection
            </h4>
            <div class="flex items-center gap-2">
              <Button size="sm" variant="outline" :disabled="isTesting" @click="onTest">
                <Icon name="i-lucide-plug-zap" class="mr-1.5 h-3.5 w-3.5" />
                Test
              </Button>
              <Badge v-if="testResult" variant="outline" :class="testResult.ok ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'">
                HTTP {{ testResult.status }}
              </Badge>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <h4 class="text-sm font-medium">
              Fetch Data
            </h4>
            <p class="text-xs text-muted-foreground">
              Enter a path on the external ERP's API (e.g. <code>/api/customers/</code>) to pull it in.
            </p>
            <div class="flex gap-2">
              <Input v-model="fetchPath" placeholder="/api/customers/" class="text-xs" />
              <Button size="sm" :disabled="!fetchPath.trim() || isFetching" @click="onFetch">
                Fetch
              </Button>
            </div>
            <pre v-if="lastFetchResult" class="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs">{{ preview(lastFetchResult) }}</pre>
          </div>

          <Separator />

          <div class="flex flex-col gap-2">
            <h4 class="text-sm font-medium">
              Recent Fetches
            </h4>
            <p v-if="!records.length" class="text-sm text-muted-foreground">
              Nothing fetched yet.
            </p>
            <div v-for="record in records" :key="record.id" class="flex flex-col gap-1 rounded-md border p-2 text-xs">
              <div class="flex items-center justify-between">
                <span class="font-mono">{{ record.path }}</span>
                <span class="text-muted-foreground">{{ formatDateTime(record.fetchedAt) }}</span>
              </div>
              <pre class="max-h-32 overflow-auto text-muted-foreground">{{ preview(record.rawJson) }}</pre>
            </div>
          </div>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
