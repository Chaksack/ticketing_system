<script setup lang="ts">
import { toast } from 'vue-sonner'
import MailLayout from '~/components/mail/Layout.vue'

const { status, messages, isLoadingMessages, fetchStatus, connect, disconnect, fetchMessages, fetchMessageBody } = useGmailAccount()
const route = useRoute()
const router = useRouter()

const isCheckingStatus = ref(true)

onMounted(async () => {
  await fetchStatus()
  isCheckingStatus.value = false

  if (route.query.connected === '1') {
    toast('Gmail connected', { description: `You're now connected as ${status.value.email}.` })
    router.replace({ query: {} })
  }
  else if (route.query.gmail_error) {
    toast.error('Could not connect Gmail', {
      description: 'Something went wrong during the Google sign-in flow. Please try again.',
    })
    router.replace({ query: {} })
  }

  if (status.value.connected)
    await fetchMessages()
})

const accounts = computed(() => status.value.email ? [{ label: status.value.email, email: status.value.email, icon: 'mdi:google' }] : [])

const selectedMailId = ref<string>()

watch(selectedMailId, async (id) => {
  if (id)
    await fetchMessageBody(id)
})

const isDisconnecting = ref(false)

async function onDisconnect() {
  isDisconnecting.value = true
  try {
    await disconnect()
    toast('Gmail disconnected')
  }
  finally {
    isDisconnecting.value = false
  }
}
</script>

<template>
  <div class="-m-4 lg:-m-6">
    <div v-if="isCheckingStatus" class="flex h-[60vh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>

    <div v-else-if="!status.connected" class="flex h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div class="flex size-16 items-center justify-center rounded-full bg-muted">
        <Icon name="i-lucide-mail" class="size-8 text-muted-foreground" />
      </div>
      <div>
        <h2 class="text-lg font-semibold">
          Connect your Gmail
        </h2>
        <p class="text-sm text-muted-foreground">
          Connect your Gmail account to read and reply to your inbox from here.
        </p>
      </div>
      <Button @click="connect">
        <Icon name="i-lucide-plug" class="mr-2 h-4 w-4" />
        Connect Gmail
      </Button>
    </div>

    <template v-else>
      <div class="flex items-center justify-between border-b px-4 py-2 lg:px-6">
        <span class="text-sm text-muted-foreground">Connected as <span class="font-medium text-foreground">{{ status.email }}</span></span>
        <Button size="sm" variant="ghost" :disabled="isDisconnecting" @click="onDisconnect">
          Disconnect
        </Button>
      </div>
      <p v-if="isLoadingMessages && !messages.length" class="p-6 text-sm text-muted-foreground">
        Loading your inbox…
      </p>
      <MailLayout
        v-else
        v-model:selected-mail="selectedMailId"
        :accounts="accounts"
        :mails="messages"
        :nav-collapsed-size="4"
      />
    </template>
  </div>
</template>
