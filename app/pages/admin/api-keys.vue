<script setup lang="ts">
import type { ApiKey, ApiKeyScope } from '~/types/api-key'
import { toast } from 'vue-sonner'
import { API_KEY_SCOPES } from '~/types/api-key'

definePageMeta({
  middleware: 'admin',
})

const { keys, fetchApiKeys, createApiKey, updateApiKey, revokeApiKey, deleteApiKey } = useApiKeys()

onMounted(() => {
  fetchApiKeys()
})

const SCOPE_LABELS: Record<ApiKeyScope, string> = {
  clients: 'Clients',
  projects: 'Projects',
  products: 'Products',
  tenders: 'Tenders',
}

function scopePath(scope: ApiKeyScope) {
  return `/api/integrations/export/${scope.replace('_', '-')}`
}

const isAddOpen = ref(false)
const label = ref('')
const selectedScopes = ref<ApiKeyScope[]>([])
const isSaving = ref(false)

function toggleScope(scopes: ApiKeyScope[], scope: ApiKeyScope, checked: boolean) {
  return checked
    ? [...scopes, scope]
    : scopes.filter(s => s !== scope)
}

const isRevealOpen = ref(false)
const revealedKey = ref('')
const copied = ref(false)

// Scopes of the key just created in this visit — drives the live examples in the help card.
const lastCreatedScopes = ref<ApiKeyScope[]>([])

async function onCreate() {
  if (!label.value.trim() || !selectedScopes.value.length)
    return

  isSaving.value = true
  try {
    const { apiKey, key } = await createApiKey({ label: label.value.trim(), scopes: selectedScopes.value })
    label.value = ''
    selectedScopes.value = []
    isAddOpen.value = false
    lastCreatedScopes.value = apiKey.scopes
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

const isEditOpen = ref(false)
const editingId = ref('')
const editLabel = ref('')
const editScopes = ref<ApiKeyScope[]>([])

function openEdit(apiKey: ApiKey) {
  editingId.value = apiKey.id
  editLabel.value = apiKey.label
  editScopes.value = [...apiKey.scopes]
  isEditOpen.value = true
}

async function onSaveEdit() {
  if (!editLabel.value.trim() || !editScopes.value.length)
    return

  isSaving.value = true
  try {
    await updateApiKey(editingId.value, { label: editLabel.value.trim(), scopes: editScopes.value })
    isEditOpen.value = false
    toast('Key updated')
  }
  catch (error: any) {
    toast.error('Could not update key', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
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

const pendingDelete = ref<ApiKey | null>(null)

async function onConfirmDelete() {
  const apiKey = pendingDelete.value
  if (!apiKey)
    return

  try {
    await deleteApiKey(apiKey.id)
    toast('Key deleted', { description: `"${apiKey.label}" was permanently removed.` })
  }
  catch (error: any) {
    toast.error('Could not delete key', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    pendingDelete.value = null
  }
}

const origin = useRequestURL().origin

const exampleScopes = computed<ApiKeyScope[]>(() => lastCreatedScopes.value.length ? lastCreatedScopes.value : ['clients'])

function curlFor(path: string) {
  return `curl -H "Authorization: Bearer $API_KEY" \\\n  ${origin}${path}`
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
          Lets an external system (like an ERP) pull data from this app — see "Connect an External System" below.
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
                  @update:model-value="(checked) => selectedScopes = toggleScope(selectedScopes, scope, !!checked)"
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
            <TableHead class="w-28" />
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
                    {{ SCOPE_LABELS[scope] ?? scope }}
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
                <div class="flex justify-end gap-1">
                  <Button
                    v-if="!apiKey.revokedAt" size="icon-sm" variant="ghost" title="Edit label & scopes"
                    @click="openEdit(apiKey)"
                  >
                    <Icon name="i-lucide-pencil" class="h-4 w-4" />
                  </Button>
                  <Button
                    v-if="!apiKey.revokedAt" size="icon-sm" variant="ghost" class="text-destructive" title="Revoke (disable, keep for audit)"
                    @click="onRevoke(apiKey.id, apiKey.label)"
                  >
                    <Icon name="i-lucide-ban" class="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon-sm" variant="ghost" class="text-destructive" title="Delete permanently"
                    @click="pendingDelete = apiKey"
                  >
                    <Icon name="i-lucide-trash-2" class="h-4 w-4" />
                  </Button>
                </div>
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

    <Card>
      <CardHeader>
        <CardTitle>Connect an External System</CardTitle>
        <CardDescription>
          Hand these steps to whoever is setting up the integration on the other side.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-4 text-sm">
        <ol class="list-decimal space-y-3 pl-5">
          <li>
            <span class="font-medium">Create a key</span> with <span class="font-medium">New Key</span> above, granting only the resources the system needs.
          </li>
          <li>
            <span class="font-medium">Copy it immediately.</span> The full key is shown once. After that only its prefix is visible here.
            Store it as a secret on the external system, e.g. <code class="rounded bg-muted px-1 py-0.5 text-xs">export API_KEY=erp_…</code>
          </li>
          <li>
            <span class="font-medium">Call the API</span> with the key as a Bearer token.
            <template v-if="lastCreatedScopes.length">
              Examples for the key you just created:
            </template>
            <template v-else>
              For example:
            </template>
            <div class="mt-2 flex flex-col gap-2">
              <pre v-for="scope in exampleScopes" :key="scope" class="overflow-x-auto rounded-md border bg-muted/30 p-2 text-xs">{{ curlFor(scopePath(scope)) }}</pre>
              <p class="text-muted-foreground">
                Each returns <code class="text-xs">{ "resource", "count", "items": [...] }</code>.
                To list the resources a key can reach, call:
              </p>
              <pre class="overflow-x-auto rounded-md border bg-muted/30 p-2 text-xs">{{ curlFor('/api/integrations/export') }}</pre>
            </div>
          </li>
          <li>
            <span class="font-medium">Handle errors:</span>
            <ul class="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
              <li><code class="text-xs">401</code>: the header is missing, or the key is wrong, revoked or deleted.</li>
              <li><code class="text-xs">403</code>: the key is valid but wasn't granted that resource. Edit its scopes here.</li>
              <li><code class="text-xs">429</code>: over the 300 requests/hour limit for that key. Back off and retry later.</li>
            </ul>
          </li>
          <li>
            <span class="font-medium">Revoke</span> (<Icon name="i-lucide-ban" class="inline h-3.5 w-3.5 align-text-bottom" />) turns a key off immediately and keeps it listed for the audit trail.
            <span class="font-medium">Delete</span> (<Icon name="i-lucide-trash-2" class="inline h-3.5 w-3.5 align-text-bottom" />) removes it permanently.
            A key's secret can't be changed. To rotate it, create a new key and revoke the old one.
          </li>
        </ol>
      </CardContent>
    </Card>

    <Sheet v-model:open="isEditOpen">
      <SheetContent side="right" class="w-full sm:max-w-md overflow-y-auto p-6">
        <SheetHeader class="p-0">
          <SheetTitle>Edit API Key</SheetTitle>
          <SheetDescription>
            Change the label and which resources this key can reach. The secret itself can't be changed. To rotate it, create a new key and revoke this one.
          </SheetDescription>
        </SheetHeader>

        <div class="flex flex-col gap-4 py-4">
          <div class="flex flex-col gap-1.5">
            <Label>Label</Label>
            <Input v-model="editLabel" />
          </div>

          <div class="flex flex-col gap-1.5">
            <Label>Scopes</Label>
            <label v-for="scope in API_KEY_SCOPES" :key="scope" class="flex items-center gap-2 text-sm">
              <Checkbox
                :model-value="editScopes.includes(scope)"
                @update:model-value="(checked) => editScopes = toggleScope(editScopes, scope, !!checked)"
              />
              {{ SCOPE_LABELS[scope] }}
            </label>
          </div>
        </div>

        <SheetFooter class="p-0">
          <Button :disabled="!editLabel.trim() || !editScopes.length || isSaving" @click="onSaveEdit">
            Save Changes
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>

    <AlertDialog :open="!!pendingDelete" @update:open="(open) => { if (!open) pendingDelete = null }">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete "{{ pendingDelete?.label }}" permanently?</AlertDialogTitle>
          <AlertDialogDescription>
            Any system using this key loses access immediately, and the key disappears from this list along with its created/last-used history.
            To disable it but keep the record, use Revoke instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction class="bg-destructive text-white hover:bg-destructive/90" @click="onConfirmDelete">
            Delete Key
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

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
        <p class="text-sm text-muted-foreground">
          Next, see "Connect an External System" on this page for example requests using this key's resources.
        </p>
        <DialogFooter>
          <Button @click="isRevealOpen = false">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
