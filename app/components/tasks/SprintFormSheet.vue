<script setup lang="ts">
import type { Sprint, SprintStatus } from '~/types/sprint'
import { DateFormatter, getLocalTimeZone } from '@internationalized/date'
import { toast } from 'vue-sonner'

const props = defineProps<{
  sprint?: Sprint | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { addSprint, updateSprint } = useSprints()

const isEditing = computed(() => !!props.sprint)
const titleLabel = computed(() => isEditing.value ? 'Edit Sprint' : 'New Sprint')

const df = new DateFormatter('en-US', { dateStyle: 'medium' })

const startField = useDateTimeField()
const endField = useDateTimeField()

const name = ref('')
const goal = ref('')
const status = ref<SprintStatus>('planned')

function resetForm() {
  name.value = ''
  goal.value = ''
  status.value = 'planned'
  startField.reset()
  endField.reset()
}

watch(open, (isOpen) => {
  if (!isOpen)
    return

  if (props.sprint) {
    name.value = props.sprint.name
    goal.value = props.sprint.goal ?? ''
    status.value = props.sprint.status
    startField.setFromIso(props.sprint.startDate)
    endField.setFromIso(props.sprint.endDate)
  }
  else {
    resetForm()
  }
})

async function onSubmit() {
  if (!name.value.trim())
    return

  const payload = {
    name: name.value.trim(),
    goal: goal.value.trim() || undefined,
    status: status.value,
    startDate: startField.toIso(),
    endDate: endField.toIso(),
  }

  try {
    if (isEditing.value && props.sprint) {
      await updateSprint(props.sprint.id, payload)
      toast('Saved', { description: `${name.value} was updated.` })
    }
    else {
      await addSprint(payload)
      toast('Created', { description: `${name.value} was added.` })
    }
    open.value = false
  }
  catch (error: any) {
    toast.error('Could not save', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-lg overflow-y-auto p-6">
      <SheetHeader class="p-0">
        <SheetTitle>{{ titleLabel }}</SheetTitle>
        <SheetDescription class="sr-only">
          {{ titleLabel }}
        </SheetDescription>
      </SheetHeader>

      <div class="flex flex-col gap-4 py-4">
        <div class="flex flex-col gap-1.5">
          <Label>Name</Label>
          <Input v-model="name" placeholder="Sprint name" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Goal</Label>
          <Textarea v-model="goal" placeholder="Sprint goal (optional)" rows="3" />
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select v-model="status">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="planned">
                Planned
              </SelectItem>
              <SelectItem value="active">
                Active
              </SelectItem>
              <SelectItem value="completed">
                Completed
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>Start Date</Label>
          <div class="flex items-center gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" :class="cn('flex-1 justify-start text-left font-normal px-3', !startField.date.value && 'text-muted-foreground')">
                  <Icon name="i-lucide-calendar" class="mr-2 h-4 w-4" />
                  {{ startField.date.value ? df.format(startField.date.value.toDate(getLocalTimeZone())) : 'Pick a date' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="startField.date.value" initial-focus />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>End Date</Label>
          <div class="flex items-center gap-1">
            <Popover>
              <PopoverTrigger as-child>
                <Button variant="outline" :class="cn('flex-1 justify-start text-left font-normal px-3', !endField.date.value && 'text-muted-foreground')">
                  <Icon name="i-lucide-calendar" class="mr-2 h-4 w-4" />
                  {{ endField.date.value ? df.format(endField.date.value.toDate(getLocalTimeZone())) : 'Pick a date' }}
                </Button>
              </PopoverTrigger>
              <PopoverContent class="w-auto p-0">
                <Calendar v-model="endField.date.value" initial-focus />
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <SheetFooter class="p-0">
        <Button variant="secondary" @click="open = false">
          Cancel
        </Button>
        <Button @click="onSubmit">
          {{ isEditing ? 'Update' : 'Create' }}
        </Button>
      </SheetFooter>
    </SheetContent>
  </Sheet>
</template>
