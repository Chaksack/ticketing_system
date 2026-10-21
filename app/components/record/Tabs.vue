<script setup lang="ts">
/**
 * Record form tabs in the Dynamics 365 style: Summary · Details · [the related table you opened] ·
 * Related ▾. Choosing an item from "Related" opens it as a tab right before the menu.
 */
const props = defineProps<{
  related: { value: string, label: string, count?: number, icon: string }[]
}>()
const tab = defineModel<string>({ required: true })

const fixed = [{ value: 'summary', label: 'Summary' }, { value: 'details', label: 'Details' }]
const openRelated = computed(() => props.related.find(r => r.value === tab.value))
</script>

<template>
  <div role="tablist" aria-label="Record sections" class="flex flex-wrap items-end gap-1 border-b border-border">
    <button
      v-for="item in fixed"
      :key="item.value"
      type="button"
      role="tab"
      :aria-selected="tab === item.value"
      class="relative -mb-px min-h-11 px-3.5 text-sm font-semibold transition-colors"
      :class="tab === item.value ? 'border-b-[3px] border-brand-forest text-foreground dark:border-brand-lime' : 'border-b-[3px] border-transparent text-muted-foreground hover:text-foreground'"
      @click="tab = item.value"
    >
      {{ item.label }}
    </button>
    <button
      v-if="openRelated"
      type="button"
      role="tab"
      aria-selected="true"
      class="relative -mb-px flex min-h-11 items-center gap-1.5 border-b-[3px] border-brand-forest px-3.5 text-sm font-semibold text-foreground dark:border-brand-lime"
    >
      <Icon :name="openRelated.icon" class="size-4" />
      {{ openRelated.label }}<span v-if="openRelated.count !== undefined" class="rounded-full bg-muted px-1.5 text-xs tabular-nums">{{ openRelated.count }}</span>
    </button>
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <button type="button" class="relative -mb-px flex min-h-11 items-center gap-1 border-b-[3px] border-transparent px-3.5 text-sm font-semibold text-muted-foreground hover:text-foreground" aria-label="Related records">
          Related
          <Icon name="i-lucide-chevron-down" class="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" class="min-w-56 rounded-xl">
        <DropdownMenuLabel class="text-xs text-muted-foreground">
          Related
        </DropdownMenuLabel>
        <DropdownMenuItem v-for="item in related" :key="item.value" class="gap-2.5" @select="tab = item.value">
          <Icon :name="item.icon" class="size-4 text-muted-foreground" />
          {{ item.label }}
          <span v-if="item.count !== undefined" class="ml-auto text-xs tabular-nums text-muted-foreground">{{ item.count }}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
