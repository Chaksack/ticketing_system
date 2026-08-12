<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import type { StaffMember, StaffStatus } from '~/types/staff'
import { toast } from 'vue-sonner'

const props = defineProps<{
  staff: StaffMember | null
}>()

const emit = defineEmits<{
  (e: 'deleted'): void
}>()

const open = defineModel<boolean>('open', { default: false })

const { updateStatus, setOnCall, removeStaff } = useStaff()

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'disabled', label: 'Disabled' },
  { value: 'pending', label: 'Pending invite' },
] as const

async function onStatusChange(value: AcceptableValue) {
  if (!props.staff || value === null)
    return

  await updateStatus(props.staff.id, value as StaffStatus)

  toast('Status updated', {
    description: `${props.staff.name} is now ${value}.`,
  })
}

async function onOnCallChange(value: boolean) {
  if (!props.staff)
    return

  await setOnCall(props.staff.id, value)

  toast(value ? 'Added to on-call rotation' : 'Removed from on-call rotation', {
    description: value
      ? `${props.staff.name} will be paged when new tickets are reported.`
      : `${props.staff.name} will no longer be paged.`,
  })
}

async function onDelete() {
  if (!props.staff)
    return

  const name = props.staff.name
  await removeStaff(props.staff.id)
  open.value = false
  emit('deleted')

  toast('Staff member removed', {
    description: `${name} no longer has access to the platform.`,
  })
}

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-md p-0">
      <template v-if="staff">
        <SheetHeader class="p-6 pb-0">
          <SheetDescription class="font-mono text-xs">
            {{ staff.id }}
          </SheetDescription>
          <SheetTitle>{{ staff.name }}</SheetTitle>
          <div class="flex flex-wrap items-center gap-2 pt-1">
            <Badge :variant="staff.role === 'admin' ? 'default' : 'secondary'" class="capitalize">
              {{ staff.role }}
            </Badge>
            <Select :model-value="staff.status" @update:model-value="onStatusChange">
              <SelectTrigger class="h-7 w-auto gap-1.5 px-2 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="option in statusOptions" :key="option.value" :value="option.value">
                  {{ option.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </SheetHeader>

        <div class="flex flex-col gap-6 px-6 pt-4">
          <div class="flex flex-col gap-1">
            <span class="text-sm text-muted-foreground">Email</span>
            <span class="text-sm font-medium">{{ staff.email }}</span>
          </div>

          <div class="flex flex-col gap-1">
            <span class="text-sm text-muted-foreground">Joined</span>
            <span class="text-sm font-medium">{{ formatDate(staff.createdAt) }}</span>
          </div>

          <Separator />

          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-0.5">
              <Label for="on-call">On-call</Label>
              <span class="text-xs text-muted-foreground">
                Page this staff member when a new ticket is reported.
              </span>
            </div>
            <Switch
              id="on-call"
              :model-value="staff.onCall"
              :disabled="staff.status === 'disabled'"
              @update:model-value="onOnCallChange"
            />
          </div>

          <Separator />

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="destructive">
                <Icon name="i-lucide-trash-2" class="mr-2 h-4 w-4" />
                Delete Staff Member
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {{ staff.name }}?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove this staff member and revoke their access to the platform. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction @click="onDelete">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
