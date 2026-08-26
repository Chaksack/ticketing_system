<script setup lang="ts">
import { toast } from 'vue-sonner'

const { isSupported, isSubscribed, checkSubscription, subscribe, unsubscribe } = usePush()
const { currentUser, isBd, isSm } = useAuth()

const isWorking = ref(false)

onMounted(() => {
  checkSubscription()
})

async function onToggle(enable: boolean) {
  isWorking.value = true
  try {
    if (enable) {
      await subscribe()
      toast('Push notifications enabled', {
        description: 'You\'ll get a notification on this device for new tickets, assignments, and reminders you\'re eligible for.',
      })
    }
    else {
      await unsubscribe()
      toast('Push notifications disabled', {
        description: 'You will no longer receive push notifications on this device.',
      })
    }
  }
  catch (error: any) {
    toast.error('Could not update notifications', {
      description: error?.message ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isWorking.value = false
  }
}
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      Notifications
    </h3>
    <p class="text-sm text-muted-foreground">
      Manage push notifications for this browser/device.
    </p>
  </div>
  <Separator />

  <div v-if="!isSupported" class="rounded-md border p-4 text-sm text-muted-foreground">
    Push notifications aren't supported in this browser.
  </div>

  <div v-else class="flex flex-col gap-6">
    <div class="flex flex-row items-center justify-between border rounded-lg p-4">
      <div class="space-y-0.5">
        <Label for="push-notifications" class="text-base">Push notifications</Label>
        <p class="text-sm text-muted-foreground">
          {{ isSubscribed ? 'Enabled on this device.' : 'Turn on to receive alerts on this device.' }}
        </p>
      </div>
      <Switch id="push-notifications" :model-value="isSubscribed" :disabled="isWorking" @update:model-value="onToggle" />
    </div>

    <div class="flex flex-col gap-2 text-sm text-muted-foreground">
      <p class="font-medium text-foreground">
        What you'll be notified about
      </p>
      <ul class="list-disc list-inside space-y-1">
        <li v-if="currentUser?.roles.some(r => r === 'agent' || r === 'admin')">
          New tickets, if you're on-call, and tickets assigned to you
        </li>
        <li v-if="isBd || isSm">
          Clients assigned to you and AMC contracts nearing renewal
        </li>
      </ul>
      <p v-if="!currentUser?.roles.length" class="italic">
        Notification types depend on your role.
      </p>
    </div>
  </div>
</template>
