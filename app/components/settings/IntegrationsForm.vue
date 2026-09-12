<script setup lang="ts">
import type { IntegrationProvider } from '~/types/integration'
import { toast } from 'vue-sonner'

const { integrations, fetchIntegrations, connect, disconnect, sendSlackTestMessage } = useIntegrations()
const route = useRoute()
const router = useRouter()

const isTestingSlack = ref(false)
const isDisconnecting = ref<IntegrationProvider | null>(null)

onMounted(async () => {
  await fetchIntegrations()

  const connectedProvider = typeof route.query.connected === 'string' ? route.query.connected : null
  if (connectedProvider) {
    const status = integrations.value.find(i => i.provider === connectedProvider)
    toast(`${status?.label ?? connectedProvider} connected`, {
      description: status?.externalAccountLabel ? `Connected as ${status.externalAccountLabel}.` : undefined,
    })
    router.replace({ query: {} })
  }
  else if (route.query.integration_error) {
    toast.error('Could not connect', {
      description: 'Something went wrong during that sign-in flow. Please try again.',
    })
    router.replace({ query: {} })
  }
})

async function onDisconnect(provider: IntegrationProvider) {
  isDisconnecting.value = provider
  try {
    await disconnect(provider)
    toast('Disconnected')
  }
  catch (error: any) {
    toast.error('Could not disconnect', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isDisconnecting.value = null
  }
}

async function onSendSlackTest() {
  isTestingSlack.value = true
  try {
    await sendSlackTestMessage()
    toast('Test message sent', { description: 'Check Slack for a DM from the app.' })
  }
  catch (error: any) {
    toast.error('Could not send test message', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isTestingSlack.value = false
  }
}
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      Integrations
    </h3>
    <p class="text-sm text-muted-foreground">
      Connect third-party apps to your account.
    </p>
  </div>
  <Separator />

  <div class="flex flex-col gap-3">
    <div v-for="integration in integrations" :key="integration.provider" class="flex flex-row items-center justify-between gap-3 rounded-lg border p-4">
      <div class="flex items-center gap-3">
        <div class="flex size-9 items-center justify-center rounded-md bg-muted">
          <Icon v-if="integration.provider === 'slack'" name="i-lucide-slack" class="size-5" />
          <Icon v-else name="i-lucide-puzzle" class="size-5" />
        </div>
        <div class="space-y-0.5">
          <p class="text-sm font-medium">
            {{ integration.label }}
          </p>
          <p class="text-sm text-muted-foreground">
            {{ integration.connected ? `Connected${integration.externalAccountLabel ? ` as ${integration.externalAccountLabel}` : ''}` : 'Not connected' }}
          </p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <Button
          v-if="integration.connected && integration.provider === 'slack'"
          size="sm" variant="outline" :disabled="isTestingSlack"
          @click="onSendSlackTest"
        >
          {{ isTestingSlack ? 'Sending…' : 'Send test message' }}
        </Button>
        <Button
          v-if="integration.connected"
          size="sm" variant="ghost" class="text-destructive" :disabled="isDisconnecting === integration.provider"
          @click="onDisconnect(integration.provider)"
        >
          Disconnect
        </Button>
        <Button v-else size="sm" @click="connect(integration.provider)">
          Connect
        </Button>
      </div>
    </div>

    <p v-if="!integrations.length" class="text-sm text-muted-foreground">
      Loading…
    </p>
  </div>
</template>
