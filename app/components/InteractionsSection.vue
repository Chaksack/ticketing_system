<script setup lang="ts">
import type { Interaction, InteractionType, RegardingType } from '~/types/interaction'
import { toast } from 'vue-sonner'

const props = defineProps<{
  regardingType: RegardingType
  regardingId: string
  interactions: Interaction[]
}>()

const { addInteraction, removeInteraction } = useInteractions()

const LOGGABLE_TYPES: { value: InteractionType, label: string }[] = [
  { value: 'call', label: 'Call' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'note', label: 'Note' },
]

const typeIcons: Record<InteractionType, string> = {
  email: 'i-lucide-mail',
  call: 'i-lucide-phone',
  meeting: 'i-lucide-calendar-clock',
  note: 'i-lucide-sticky-note',
}

const formType = ref<InteractionType>('call')
const formSubject = ref('')
const formBody = ref('')
const isSaving = ref(false)
const isRemoving = ref<string | null>(null)

const sorted = computed(() => [...props.interactions].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()))

async function onLogInteraction() {
  if (!formSubject.value.trim() && !formBody.value.trim())
    return

  isSaving.value = true
  try {
    await addInteraction({
      regardingType: props.regardingType,
      regardingId: props.regardingId,
      type: formType.value,
      subject: formSubject.value.trim() || undefined,
      body: formBody.value.trim() || undefined,
    })
    formSubject.value = ''
    formBody.value = ''
    toast('Interaction logged')
  }
  catch (error: any) {
    toast.error('Could not log interaction', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSaving.value = false
  }
}

async function onRemove(id: string) {
  isRemoving.value = id
  try {
    await removeInteraction(id)
  }
  finally {
    isRemoving.value = null
  }
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function directionLabel(interaction: Interaction) {
  if (interaction.type !== 'email' || !interaction.direction)
    return ''
  return interaction.direction === 'sent' ? 'Sent' : 'Received'
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <h4 class="text-sm font-medium">
      Interactions
    </h4>

    <div class="flex flex-col gap-2 rounded-md border p-3">
      <div class="flex gap-2">
        <Select v-model="formType">
          <SelectTrigger class="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="option in LOGGABLE_TYPES" :key="option.value" :value="option.value">
              {{ option.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Input v-model="formSubject" placeholder="Subject" class="flex-1" />
      </div>
      <Textarea v-model="formBody" rows="2" placeholder="Notes..." />
      <div class="flex justify-end">
        <Button size="sm" :disabled="isSaving || (!formSubject.trim() && !formBody.trim())" @click="onLogInteraction">
          Log Interaction
        </Button>
      </div>
    </div>

    <p v-if="!sorted.length" class="text-sm text-muted-foreground">
      No interactions logged yet.
    </p>
    <div v-for="interaction in sorted" :key="interaction.id" class="flex items-start gap-2 rounded-md border p-2 text-sm">
      <Icon :name="typeIcons[interaction.type]" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span v-if="interaction.subject" class="font-medium truncate">{{ interaction.subject }}</span>
          <Badge v-if="directionLabel(interaction)" variant="outline" class="text-[10px]">
            {{ directionLabel(interaction) }}
          </Badge>
        </div>
        <p v-if="interaction.body" class="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
          {{ interaction.body }}
        </p>
        <span class="text-xs text-muted-foreground">{{ formatDateTime(interaction.occurredAt) }}</span>
      </div>
      <Button size="icon-sm" variant="ghost" class="size-6 shrink-0 text-muted-foreground" :disabled="isRemoving === interaction.id" @click="onRemove(interaction.id)">
        <Icon name="i-lucide-x" class="size-3" />
      </Button>
    </div>
  </div>
</template>
