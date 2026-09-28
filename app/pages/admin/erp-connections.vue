<script setup lang="ts">
import type { ErpAuthType, ErpConnection } from '~/types/erp-connection'
import { toast } from 'vue-sonner'
import ErpConnectionDetailSheet from '~/components/erp/ErpConnectionDetailSheet.vue'

definePageMeta({
  middleware: 'admin',
})

const { connections, fetchConnections, addConnection } = useErpConnections()

onMounted(() => {
  fetchConnections()
})

const AUTH_TYPE_OPTIONS: { value: ErpAuthType, label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'api_key', label: 'API Key Header' },
  { value: 'basic', label: 'Basic Auth' },
]

const isAddOpen = ref(false)
const name = ref('')
const baseUrl = ref('')
const authType = ref<ErpAuthType>('none')
const authHeader = ref('X-API-Key')
const username = ref('')
const credential = ref('')
const isSaving = ref(false)

function resetForm() {
  name.value = ''
  baseUrl.value = ''
  authType.value = 'none'
  authHeader.value = 'X-API-Key'
  username.value = ''
  credential.value = ''
}

async function onCreate() {
  if (!name.value.trim() || !baseUrl.value.trim())
    return

  isSaving.value = true
  try {
    await addConnection({
      name: name.value.trim(),
      baseUrl: baseUrl.value.trim(),
      authType: authType.value,
      authHeader: authType.value === 'api_key' ? authHeader.value.trim() : undefined,
      username: authType.value === 'basic' ? username.value.trim() : undefined,
      credential: authType.value !== 'none' ? credential.value.trim() || undefined : undefined,
    })
    resetForm()
    isAddOpen.value = false
    toast('Connection created')
  }
  catch (error: any) {
    toast.error('Could not create connection', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

const isDetailOpen = ref(false)
const selectedConnectionId = ref<string | null>(null)
const selectedConnection = computed(() => connections.value.find(c => c.id === selectedConnectionId.value) ?? null)

function openConnection(connection: ErpConnection) {
  selectedConnectionId.value = connection.id
  isDetailOpen.value = true
}

function formatDateTime(value?: string) {
  return value ? new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Never'
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          ERP Connections
        </h2>
        <p class="text-muted-foreground">
          Connect to other ERPs and pull their data in — each fetch is stored as a raw import record.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Connection
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New ERP Connection</SheetTitle>
            <SheetDescription>
              Set up how to reach and authenticate against an external ERP's API.
            </SheetDescription>
          </SheetHeader>

          <div class="flex flex-col gap-4 py-4">
            <div class="flex flex-col gap-1.5">
              <Label>Name</Label>
              <Input v-model="name" placeholder="e.g. Acme ERP" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Base URL</Label>
              <Input v-model="baseUrl" placeholder="https://erp.example.com" />
            </div>
            <div class="flex flex-col gap-1.5">
              <Label>Authentication</Label>
              <Select v-model="authType">
                <SelectTrigger class="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="option in AUTH_TYPE_OPTIONS" :key="option.value" :value="option.value">
                    {{ option.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div v-if="authType === 'api_key'" class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Header Name</Label>
              <Input v-model="authHeader" placeholder="X-API-Key" />
            </div>
            <div v-if="authType === 'basic'" class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">Username</Label>
              <Input v-model="username" placeholder="Username" />
            </div>
            <div v-if="authType !== 'none'" class="flex flex-col gap-1.5">
              <Label class="text-xs text-muted-foreground">
                {{ authType === 'basic' ? 'Password' : authType === 'bearer' ? 'Bearer Token' : 'API Key' }}
              </Label>
              <Input v-model="credential" type="password" placeholder="Stored encrypted" />
            </div>
          </div>

          <SheetFooter class="p-0">
            <Button :disabled="!name.trim() || !baseUrl.trim() || isSaving" @click="onCreate">
              Create Connection
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Base URL</TableHead>
            <TableHead>Auth</TableHead>
            <TableHead>Last Synced</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="connections.length">
            <TableRow v-for="connection in connections" :key="connection.id" class="cursor-pointer" @click="openConnection(connection)">
              <TableCell class="font-medium">
                {{ connection.name }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ connection.baseUrl }}
              </TableCell>
              <TableCell>
                <Badge variant="outline" class="capitalize">
                  {{ connection.authType.replace('_', ' ') }}
                </Badge>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDateTime(connection.lastSyncedAt) }}
              </TableCell>
              <TableCell>
                <Badge
                  v-if="connection.lastSyncStatus" variant="outline"
                  :class="connection.lastSyncStatus === 'ok' ? 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30' : 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30'"
                >
                  {{ connection.lastSyncStatus }}
                </Badge>
                <span v-else class="text-xs text-muted-foreground">—</span>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="5" class="h-24 text-center">
              No ERP connections yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <ErpConnectionDetailSheet v-model:open="isDetailOpen" :connection="selectedConnection" />
  </div>
</template>
