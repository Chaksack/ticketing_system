<script setup lang="ts">
const { sidebar, updateAppSettings } = useAppSettings()

const variantOptions = [
  { value: 'sidebar', label: 'Sidebar' },
  { value: 'floating', label: 'Floating' },
  { value: 'inset', label: 'Inset' },
] as const

const collapsibleOptions = [
  { value: 'offcanvas', label: 'Off-canvas' },
  { value: 'icon', label: 'Icon' },
  { value: 'none', label: 'None' },
] as const

const sideOptions = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
] as const
</script>

<template>
  <div>
    <h3 class="text-lg font-medium">
      Display
    </h3>
    <p class="text-sm text-muted-foreground">
      Control how the sidebar looks and behaves. Changes apply immediately.
    </p>
  </div>
  <Separator />
  <div class="flex flex-col gap-6">
    <div class="space-y-1.5">
      <Label>Sidebar style</Label>
      <div class="grid grid-cols-3 gap-2 max-w-md">
        <Button
          v-for="option in variantOptions"
          :key="option.value"
          variant="outline"
          :class="{ '!border-primary border-2 !bg-primary/10': sidebar?.variant === option.value }"
          @click="updateAppSettings({ sidebar: { variant: option.value } })"
        >
          {{ option.label }}
        </Button>
      </div>
    </div>

    <div class="space-y-1.5">
      <Label>Collapse behavior</Label>
      <div class="grid grid-cols-3 gap-2 max-w-md">
        <Button
          v-for="option in collapsibleOptions"
          :key="option.value"
          variant="outline"
          :class="{ '!border-primary border-2 !bg-primary/10': sidebar?.collapsible === option.value }"
          @click="updateAppSettings({ sidebar: { collapsible: option.value } })"
        >
          {{ option.label }}
        </Button>
      </div>
    </div>

    <div class="space-y-1.5">
      <Label>Side</Label>
      <div class="grid grid-cols-2 gap-2 max-w-xs">
        <Button
          v-for="option in sideOptions"
          :key="option.value"
          variant="outline"
          :class="{ '!border-primary border-2 !bg-primary/10': sidebar?.side === option.value }"
          @click="updateAppSettings({ sidebar: { side: option.value } })"
        >
          {{ option.label }}
        </Button>
      </div>
    </div>
  </div>
</template>
