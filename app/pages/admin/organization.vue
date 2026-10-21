<script setup lang="ts">
import type { Organization, OrgApp } from '~/types/organization'
import { toast } from 'vue-sonner'
import { ORG_APPS, ORG_PLANS } from '~/types/organization'

definePageMeta({ middleware: 'admin' })

const { currentUser } = useAuth()
const organization = ref<Organization | null>(null)
const name = ref('')
const busy = ref(false)
const origin = useRequestURL().origin

onMounted(async () => {
  const result = await fetchUntyped<{ organization: Organization }>('/api/organization')
  organization.value = result.organization
  name.value = result.organization.name
})

async function save(patch: { name?: string, apps?: OrgApp[] }, message: string) {
  busy.value = true
  try {
    const result = await fetchUntyped<{ organization: Organization }>('/api/organization', { method: 'PATCH', body: patch })
    organization.value = result.organization
    name.value = result.organization.name
    // Keep the sidebar and header in step with the new name and apps.
    if (currentUser.value?.org)
      currentUser.value.org = { ...currentUser.value.org, name: result.organization.name, apps: result.organization.apps }
    toast(message)
  }
  catch (error: any) {
    toast.error('Could not save', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    busy.value = false
  }
}

function toggleApp(app: OrgApp, on: boolean) {
  if (!organization.value)
    return
  const apps = on ? [...organization.value.apps, app] : organization.value.apps.filter(a => a !== app)
  if (!apps.length) {
    toast.error('Keep at least one app switched on')
    return
  }
  save({ apps }, on ? 'App switched on' : 'App switched off')
}

const portalUrl = computed(() => organization.value ? `${origin}/portal/${organization.value.isHome ? '' : organization.value.slug}`.replace(/\/$/, '') : '')

async function copyPortal() {
  try {
    await navigator.clipboard.writeText(portalUrl.value)
    toast('Portal link copied')
  }
  catch {
    toast.error('Could not copy. Select the link and copy it manually.')
  }
}
</script>

<template>
  <div class="flex w-full max-w-3xl flex-col gap-5">
    <div>
      <h1 class="text-4xl font-black leading-none tracking-[-0.045em] text-foreground sm:text-[44px]">
        Organisation
      </h1>
      <p class="text-muted-foreground">
        Your company's workspace on Canopy.
      </p>
    </div>

    <p v-if="!organization" class="text-sm text-muted-foreground">
      Loading…
    </p>

    <template v-else>
      <Card>
        <CardHeader>
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent class="flex flex-col gap-4">
          <form class="flex flex-wrap items-end gap-2" @submit.prevent="save({ name }, 'Name saved')">
            <div class="flex min-w-[240px] flex-1 flex-col gap-1.5">
              <Label for="org-name">Organisation name</Label>
              <Input id="org-name" v-model="name" />
            </div>
            <Button type="submit" :disabled="busy || !name.trim() || name === organization.name">
              Save
            </Button>
          </form>
          <dl class="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt class="text-xs text-muted-foreground">
                Workspace address
              </dt>
              <dd class="font-semibold">
                {{ organization.slug }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Plan
              </dt>
              <dd class="font-semibold">
                {{ ORG_PLANS.find(p => p.id === organization!.plan)?.label }}
              </dd>
            </div>
            <div>
              <dt class="text-xs text-muted-foreground">
                Sector
              </dt>
              <dd class="font-semibold">
                {{ organization.sector ?? '—' }}
              </dd>
            </div>
          </dl>
          <div class="flex flex-col gap-1.5">
            <Label>Customer support portal</Label>
            <div class="flex items-center gap-2 rounded-xl border bg-muted/40 p-2">
              <code class="flex-1 truncate text-xs">{{ portalUrl }}</code>
              <Button size="sm" variant="outline" aria-label="Copy portal link" @click="copyPortal">
                <Icon name="i-lucide-copy" class="size-3.5" />
              </Button>
            </div>
            <span class="text-xs text-muted-foreground">Share this with your customers. Requests submitted there become tickets in your workspace.</span>
          </div>
        </CardContent>
      </Card>

      <Card v-if="!organization.isHome">
        <CardHeader>
          <CardTitle>Apps</CardTitle>
          <CardDescription>Switch off what you don't use and it disappears from everyone's sidebar. Data is kept if you switch it back on.</CardDescription>
        </CardHeader>
        <CardContent class="flex flex-col gap-2">
          <label v-for="app in ORG_APPS" :key="app.id" class="flex items-start gap-3 rounded-xl border p-3">
            <Switch :model-value="organization.apps.includes(app.id)" :disabled="busy" @update:model-value="(on) => toggleApp(app.id, !!on)" />
            <span>
              <span class="block text-sm font-semibold">{{ app.label }}</span>
              <span class="block text-xs text-muted-foreground">{{ app.description }}</span>
            </span>
          </label>
        </CardContent>
      </Card>
      <p v-else class="text-sm text-muted-foreground">
        This is Canopy's own workspace. Its admins manage every company from <NuxtLink to="/hq" class="underline">
          Canopy HQ
        </NuxtLink>.
      </p>
    </template>
  </div>
</template>
