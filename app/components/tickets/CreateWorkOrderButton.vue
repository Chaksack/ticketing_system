<script setup lang="ts">
import type { WorkOrder } from '~/types/field'
import { toast } from 'vue-sonner'

/** "Needs a site visit": turns the ticket into a Field Service work order (pre-filled, linked back). */
const props = defineProps<{ ticketId: string }>()

const { hasApp, isAdmin, currentUser } = useAuth()
const canDispatch = computed(() => hasApp('field') && (isAdmin.value || (currentUser.value?.roles ?? []).some(r => ['agent', 'engineering_coordinator', 'engineering_lead'].includes(r))))
const busy = ref(false)

async function create() {
  busy.value = true
  try {
    const { workOrder } = await fetchUntyped<{ workOrder: WorkOrder }>('/api/field/work-orders', { method: 'POST', body: { ticketId: props.ticketId } })
    toast(`${workOrder.id} created`, { description: 'It\'s waiting on the schedule board.', action: { label: 'Open', onClick: () => navigateTo(`/field/work-orders/${workOrder.id}`) } })
  }
  catch (error: any) {
    toast.error('Could not create a work order', { description: error?.data?.statusMessage })
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <Button v-if="canDispatch" size="sm" variant="outline" class="h-7 gap-1.5 text-xs" :disabled="busy" @click="create">
    <Icon name="i-lucide-wrench" class="h-3.5 w-3.5" />
    Work order
  </Button>
</template>
