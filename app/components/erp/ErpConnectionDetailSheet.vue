<script setup lang="ts">
import type { ErpConnection, ErpSyncConfig, ErpSyncResource, ErpSyncResourceResult } from '~/types/erp-connection'
import { toast } from 'vue-sonner'

const props = defineProps<{
  connection: ErpConnection | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { records, testConnection, fetchFromConnection, fetchRecords, updateConnection, syncConnection } = useErpConnections()

const syncDraft = ref<ErpSyncConfig | null>(null)

watch(() => props.connection?.id, (id) => {
  if (id)
    fetchRecords(id)
  syncDraft.value = props.connection ? structuredClone(toRaw(props.connection.syncConfig)) : null
}, { immediate: true })

const SYNC_RESOURCES: { key: ErpSyncResource, label: string, target: string }[] = [
  { key: 'customers', label: 'Customers', target: 'Clients' },
  { key: 'projects', label: 'Projects', target: 'Projects' },
]

// App field → label shown next to the ERP field-name input. `required` fields must be mapped to enable sync.
const FIELD_LABELS: Record<ErpSyncResource, { key: string, label: string, required?: boolean }[]> = {
  customers: [
    { key: 'name', label: 'Client name', required: true },
    { key: 'contactName', label: 'Contact name' },
    { key: 'contactEmail', label: 'Contact email' },
    { key: 'contactPhone', label: 'Contact phone' },
  ],
  projects: [
    { key: 'name', label: 'Project name', required: true },
    { key: 'customerId', label: 'Customer id', required: true },
    { key: 'description', label: 'Description' },
    { key: 'status', label: 'Status' },
    { key: 'startDate', label: 'Start date' },
    { key: 'endDate', label: 'End date' },
  ],
}

function resourceFields(resource: ErpSyncResource) {
  return syncDraft.value![resource].fields as unknown as Record<string, string | undefined>
}

const isSavingSync = ref(false)
const isSyncing = ref(false)

async function onSaveSync() {
  if (!props.connection || !syncDraft.value)
    return
  isSavingSync.value = true
  try {
    await updateConnection(props.connection.id, { syncConfig: syncDraft.value })
    toast('Sync settings saved', { description: 'Enabled resources sync every hour.' })
  }
  catch (error: any) {
    toast.error('Could not save sync settings', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSavingSync.value = false
  }
}

function describeResult(label: string, result?: ErpSyncResourceResult) {
  return result ? `${label}: ${result.created} new, ${result.updated} updated, ${result.skipped} skipped` : ''
}

async function onSyncNow() {
  if (!props.connection)
    return
  isSyncing.value = true
  try {
    const summary = await syncConnection(props.connection.id)
    const errors = [...(summary.customers?.errors ?? []), ...(summary.projects?.errors ?? [])]
    const description = [describeResult('Customers', summary.customers), describeResult('Projects', summary.projects)].filter(Boolean).join(' · ')
    if (errors.length)
      toast.warning('Sync finished with problems', { description: `${description}. See "Last sync" for details.` })
    else
      toast('Sync complete', { description })
  }
  catch (error: any) {
    toast.error('Could not sync', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSyncing.value = false
  }
}

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

          <div v-if="syncDraft" class="flex flex-col gap-3">
            <div>
              <h4 class="text-sm font-medium">
                Scheduled Sync
              </h4>
              <p class="text-xs text-muted-foreground">
                Enabled resources are imported every hour. Records are matched by their ERP id, so each run updates existing
                records instead of duplicating them. Only the mapped fields are updated, and only when the ERP has a value.
                Stage, notes, assignees and other fields edited here are never overwritten.
                Not sure of the field names? Use <span class="font-medium">Fetch Data</span> below on the same path and read them off the response.
              </p>
            </div>

            <div v-for="resource in SYNC_RESOURCES" :key="resource.key" class="flex flex-col gap-3 rounded-md border p-3">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium">{{ resource.label }} → {{ resource.target }}</span>
                <Switch
                  :model-value="syncDraft[resource.key].enabled"
                  @update:model-value="(value) => syncDraft![resource.key].enabled = !!value"
                />
              </div>

              <template v-if="syncDraft[resource.key].enabled">
                <div class="grid grid-cols-2 gap-2">
                  <div class="col-span-2 flex flex-col gap-1">
                    <Label class="text-xs text-muted-foreground">Path</Label>
                    <Input v-model="syncDraft[resource.key].path" class="text-xs" :placeholder="`/api/${resource.key}/`" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs text-muted-foreground">List key</Label>
                    <Input v-model="syncDraft[resource.key].listKey" class="text-xs" placeholder="auto (results, data…)" />
                  </div>
                  <div class="flex flex-col gap-1">
                    <Label class="text-xs text-muted-foreground">ERP id field *</Label>
                    <Input v-model="syncDraft[resource.key].idField" class="text-xs" placeholder="id" />
                  </div>
                </div>

                <div class="flex flex-col gap-1.5">
                  <span class="text-xs font-medium">Field mapping (app field ← ERP field)</span>
                  <div v-for="field in FIELD_LABELS[resource.key]" :key="field.key" class="grid grid-cols-[8rem_1fr] items-center gap-2">
                    <Label class="text-xs text-muted-foreground">{{ field.label }}{{ field.required ? ' *' : '' }}</Label>
                    <Input
                      :model-value="resourceFields(resource.key)[field.key] ?? ''"
                      class="h-8 text-xs" placeholder="not mapped"
                      @update:model-value="(value) => resourceFields(resource.key)[field.key] = String(value)"
                    />
                  </div>
                  <p v-if="resource.key === 'projects'" class="text-xs text-muted-foreground">
                    "Customer id" must hold the same id the customer sync uses, so each project attaches to its client. Status only
                    applies when the ERP's value is planned, active, on hold, completed or cancelled.
                  </p>
                </div>
              </template>
            </div>

            <div class="flex items-center gap-2">
              <Button size="sm" variant="outline" :disabled="isSavingSync" @click="onSaveSync">
                Save Sync Settings
              </Button>
              <Button
                size="sm"
                :disabled="isSyncing || !(connection.syncConfig.customers.enabled || connection.syncConfig.projects.enabled)"
                @click="onSyncNow"
              >
                <Icon name="i-lucide-refresh-cw" class="mr-1.5 h-3.5 w-3.5" :class="isSyncing && 'animate-spin'" />
                {{ isSyncing ? 'Syncing…' : 'Sync Now' }}
              </Button>
            </div>

            <div v-if="connection.lastSyncSummary" class="flex flex-col gap-1 rounded-md border bg-muted/30 p-2 text-xs">
              <span class="font-medium">Last sync · {{ formatDateTime(connection.lastSyncSummary.finishedAt) }}</span>
              <template v-for="resource in SYNC_RESOURCES" :key="resource.key">
                <template v-if="connection.lastSyncSummary[resource.key]">
                  <span>
                    {{ resource.label }}: {{ connection.lastSyncSummary[resource.key]!.fetched }} fetched,
                    {{ connection.lastSyncSummary[resource.key]!.created }} new,
                    {{ connection.lastSyncSummary[resource.key]!.updated }} updated,
                    {{ connection.lastSyncSummary[resource.key]!.skipped }} skipped
                  </span>
                  <span v-for="(error, index) in connection.lastSyncSummary[resource.key]!.errors" :key="index" class="text-red-600 dark:text-red-400">
                    {{ error }}
                  </span>
                </template>
              </template>
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
