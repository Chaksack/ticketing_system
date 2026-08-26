<script setup lang="ts">
import type { StaffMember } from '~/types/staff'

const props = withDefaults(defineProps<{
  modelValue?: string[]
  staff: StaffMember[]
}>(), {
  modelValue: () => [],
})

const emit = defineEmits<{
  'update:modelValue': [value: string[]]
}>()

const isOpen = ref(false)

const selected = computed(() => props.staff.filter(s => props.modelValue.includes(s.id)))

function toggle(staffId: string) {
  const next = props.modelValue.includes(staffId)
    ? props.modelValue.filter(id => id !== staffId)
    : [...props.modelValue, staffId]
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <Badge v-for="person in selected" :key="person.id" variant="secondary" class="gap-1">
      {{ person.name }}
      <button type="button" class="ml-0.5" @click="toggle(person.id)">
        <Icon name="i-lucide-x" class="h-3 w-3" />
      </button>
    </Badge>

    <span v-if="!selected.length" class="text-xs text-muted-foreground">Unassigned</span>

    <Popover v-model:open="isOpen">
      <PopoverTrigger as-child>
        <Button variant="outline" size="sm" class="h-6 gap-1 px-2 text-xs">
          <Icon name="i-lucide-plus" class="h-3 w-3" />
          Assign
        </Button>
      </PopoverTrigger>
      <PopoverContent class="w-[220px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search staff..." />
          <CommandList>
            <CommandEmpty class="p-2 text-xs text-muted-foreground">
              No matching staff.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem v-for="person in staff" :key="person.id" :value="person.name" @select="toggle(person.id)">
                <Icon v-if="modelValue.includes(person.id)" name="i-lucide-check" class="mr-2 h-3.5 w-3.5" />
                <span v-else class="mr-2 h-3.5 w-3.5 shrink-0" />
                {{ person.name }}
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </div>
</template>
