<script setup lang="ts">
import type { ApiKeyScope } from '~/types/api-key'
import { toast } from 'vue-sonner'
import { API_KEY_SCOPES } from '~/types/api-key'

definePageMeta({
  middleware: 'admin',
})

const { keys, fetchApiKeys, createApiKey, revokeApiKey } = useApiKeys()

onMounted(() => {
  fetchApiKeys()
})

const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  clients: 'Clients',
  invoices: 'Invoices',
  projects: 'Projects',
  products: 'Products',
  vendor_bills: 'Vendor Bills',
}

const isAddOpen = ref(false)
const label = ref('')
const selectedScopes = ref<ApiKeyScope[]>([])
const isSaving = ref(false)

function toggleScope(scope: ApiKeyScope, checked: boolean) {
  selectedScopes.value = checked
    ? [...selectedScopes.value, scope]
    : selectedScopes.value.filter(s => s !== scope)
}

const isRevealOpen = ref(false)
const revealedKey = ref('')
const copied = ref(false)

async function onCreate() {
  if (!label.value.trim() || !selectedScopes.value.length)
    return

  isSaving.value = true
  try {
    const { key } = await createApiKey({ label: label.value.trim(), scopes: selectedScopes.value })
    label.value = ''
    selectedScopes.value = []
    isAddOpen.value = false
    revealedKey.value = key
    copied.value = false
    isRevealOpen.value = true
  }
  catch (error: any) {
    toast.error('Could not create API key', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

async function onCopyKey() {
  try {
    await navigator.clipboard.writeText(revealedKey.value)
    copied.value = true
    toast('Copied to clipboard')
  }
  catch {
    toast.error('Could not copy — select and copy the key manually')
  }
}

async function onRevoke(id: string, label: string) {
  try {
    await revokeApiKey(id)
    toast('Key revoked', { description: `"${label}" can no longer be used.` })
  }
  catch (error: any) {
    toast.error('Could not revoke key', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div class="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 class="text-2xl font-bold tracking-tight">
          API Keys
        </h2>
        <p class="text-muted-foreground">
          Lets an external system (like an ERP) pull data from this app — see the ERP Export API section in the README.
        </p>
      </div>

      <Sheet v-model:open="isAddOpen">
        <SheetTrigger as-child>
          <Button>
            <Icon name="i-lucide-plus" class="mr-2 h-4 w-4" />
            New Key
          </Button>
        </SheetTrigger>
        <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto p-6">
          <SheetHeader class="p-0">
            <SheetTitle>New API Key</SheetTitle>
            <SheetDescription>
              The full key is shown once, right after creation — copy it then, it can't be retrieved again.
            </SheetDescription>
          </SheetHeader>

          <div class="flex flex-col gap-4 py-4">
            <div class="flex flex-col gap-1.5">
              <Label>Label</Label>
              <Input v-model="label" placeholder="e.g. Django ERP sync" />
            </div>

            <div class="flex flex-col gap-1.5">
              <Label>Scopes</Label>
              <label v-for="scope in API_KEY_SCOPES" :key="scope" class="flex items-center gap-2 text-sm">
                <Checkbox
                  :model-value="selectedScopes.includes(scope)"
                  @update:model-value="(checked) => toggleScope(scope, !!checked)"
                />
                {{ SCOPE_LABELS[scope] }}
              </label>
            </div>
          </div>

          <SheetFooter class="p-0">
            <Button :disabled="!label.trim() || !selectedScopes.length || isSaving" @click="onCreate">
              Create Key
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Label</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Scopes</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Status</TableHead>
            <TableHead class="w-16" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <template v-if="keys.length">
            <TableRow v-for="apiKey in keys" :key="apiKey.id">
              <TableCell class="font-medium">
                {{ apiKey.label }}
              </TableCell>
              <TableCell class="font-mono text-xs text-muted-foreground">
                {{ apiKey.keyPrefix }}…
              </TableCell>
              <TableCell>
                <div class="flex flex-wrap gap-1">
                  <Badge v-for="scope in apiKey.scopes" :key="scope" variant="outline" class="text-[10px]">
                    {{ SCOPE_LABELS[scope] }}
                  </Badge>
                </div>
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDate(apiKey.createdAt) }}
              </TableCell>
              <TableCell class="text-sm text-muted-foreground">
                {{ formatDate(apiKey.lastUsedAt) }}
              </TableCell>
              <TableCell>
                <Badge v-if="apiKey.revokedAt" variant="outline" class="bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30">
                  Revoked
                </Badge>
                <Badge v-else variant="outline" class="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
                  Active
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  v-if="!apiKey.revokedAt" size="icon-sm" variant="ghost" class="text-destructive"
                  @click="onRevoke(apiKey.id, apiKey.label)"
                >
                  <Icon name="i-lucide-ban" class="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          </template>
          <TableRow v-else>
            <TableCell :colspan="7" class="h-24 text-center">
              No API keys yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="isRevealOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Your new API key</DialogTitle>
          <DialogDescription>
            Copy it now — for security, this is the only time it's shown. If it's lost, revoke this key and create a new one.
          </DialogDescription>
        </DialogHeader>
        <div class="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
          <code class="flex-1 overflow-x-auto text-xs">{{ revealedKey }}</code>
          <Button size="sm" variant="outline" @click="onCopyKey">
            <Icon :name="copied ? 'i-lucide-check' : 'i-lucide-copy'" class="mr-1.5 h-3.5 w-3.5" />
            {{ copied ? 'Copied' : 'Copy' }}
          </Button>
        </div>
        <DialogFooter>
          <Button @click="isRevealOpen = false">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
