<script setup lang="ts">
import type { FieldAsset } from '~/types/field'
import { toast } from 'vue-sonner'

definePageMeta({ middleware: 'agent' })

const { isAdmin, currentUser } = useAuth()
const isDispatcher = computed(() => isAdmin.value || (currentUser.value?.roles ?? []).some(r => ['agent', 'engineering_coordinator', 'engineering_lead'].includes(r)))
const { clients, fetchClients } = useClients()
const { confirm } = useConfirm()

const assets = ref<FieldAsset[]>([])
const search = ref('')
async function load() {
  assets.value = (await fetchUntyped<{ assets: FieldAsset[] }>('/api/field/assets')).assets
}
onMounted(async () => {
  await load()
  if (isDispatcher.value)
    await fetchClients()
})

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return q ? assets.value.filter(a => [a.name, a.model, a.serial, a.clientName, a.location].some(v => v?.toLowerCase().includes(q))) : assets.value
})

const isEditOpen = ref(false)
const form = reactive({ id: '', clientId: '', name: '', model: '', serial: '', location: '', installedAt: '', notes: '' })
function edit(asset?: FieldAsset) {
  Object.assign(form, { id: asset?.id ?? '', clientId: asset?.clientId ?? '', name: asset?.name ?? '', model: asset?.model ?? '', serial: asset?.serial ?? '', location: asset?.location ?? '', installedAt: asset?.installedAt?.slice(0, 10) ?? '', notes: asset?.notes ?? '' })
  isEditOpen.value = true
}
async function save() {
  try {
    await $fetch('/api/field/assets', { method: 'POST', body: { ...form, id: form.id || undefined, clientId: form.clientId || null } })
    toast(form.id ? 'Asset saved' : 'Asset added')
    isEditOpen.value = false
    await load()
  }
  catch (error: any) {
    toast.error('Could not save the asset', { description: error?.data?.statusMessage })
  }
}
async function remove() {
  if (!form.id || !(await confirm({ title: `Delete ${form.name}?`, confirmLabel: 'Delete', destructive: true })))
    return
  try {
    await $fetch(`/api/field/assets/${form.id}`, { method: 'DELETE' })
    isEditOpen.value = false
    await load()
  }
  catch (error: any) {
    toast.error('Could not delete', { description: error?.data?.statusMessage })
  }
}

const date = (iso?: string) => iso ? new Date(iso).toLocaleDateString(APP_LOCALE, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <FieldNav />

    <PageActions v-if="isDispatcher" label="Asset actions">
      <Button variant="lime" @click="edit()">
        <Icon name="i-lucide-plus" />
        New asset
      </Button>
    </PageActions>

    <PageTitle title="Assets" description="Equipment you service at client sites. Each work order on an asset builds its history." />

    <div class="relative max-w-sm">
      <Icon name="i-lucide-search" class="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input v-model="search" placeholder="Search name, model, serial, client…" class="pl-9" aria-label="Search assets" />
    </div>

    <div class="rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Asset</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Installed</TableHead>
            <TableHead class="text-right">
              Jobs
            </TableHead>
            <TableHead>Last serviced</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="asset in visible" :key="asset.id" :class="isDispatcher ? 'cursor-pointer' : ''" @click="isDispatcher && edit(asset)">
            <TableCell>
              <div class="font-semibold text-foreground">
                {{ asset.name }}
              </div>
              <div class="text-xs text-muted-foreground">
                {{ [asset.id, asset.model, asset.serial].filter(Boolean).join(' · ') }}
              </div>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ asset.clientName ?? '—' }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ asset.location ?? '—' }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ date(asset.installedAt) }}
            </TableCell>
            <TableCell class="text-right tabular-nums">
              {{ asset.workOrderCount }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ date(asset.lastServicedAt) }}
            </TableCell>
          </TableRow>
          <TableRow v-if="!visible.length">
            <TableCell :colspan="6" class="h-24 text-center text-muted-foreground">
              No assets yet.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <Dialog v-model:open="isEditOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ form.id ? 'Edit asset' : 'New asset' }}</DialogTitle>
          <DialogDescription>Link it to a client so technicians see it on their jobs.</DialogDescription>
        </DialogHeader>
        <form class="flex flex-col gap-3" @submit.prevent="save">
          <Input v-model="form.name" placeholder="Name, e.g. Loop detector LD-2" aria-label="Name" />
          <Select v-model="form.clientId">
            <SelectTrigger class="w-full" aria-label="Client">
              <SelectValue placeholder="Client (optional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="client in clients" :key="client.id" :value="client.id">
                {{ client.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <div class="grid grid-cols-2 gap-3">
            <Input v-model="form.model" placeholder="Model" aria-label="Model" />
            <Input v-model="form.serial" placeholder="Serial number" aria-label="Serial number" />
          </div>
          <Input v-model="form.location" placeholder="Location on site" aria-label="Location" />
          <div class="flex flex-col gap-1.5">
            <Label for="asset-installed">Installed</Label>
            <Input id="asset-installed" v-model="form.installedAt" type="date" />
          </div>
          <Textarea v-model="form.notes" rows="2" placeholder="Notes" aria-label="Notes" />
          <DialogFooter class="gap-2">
            <Button v-if="form.id" type="button" variant="ghost" class="text-destructive" @click="remove">
              Delete
            </Button>
            <Button type="submit" :disabled="!form.name.trim()">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
