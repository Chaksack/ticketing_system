<script setup lang="ts">
defineProps<{
  status: string
}>()

const STYLES: Record<string, { label: string, class: string }> = {
  active: { label: 'Active', class: 'bg-brand-mist text-brand-forest border-brand-forest/20 dark:bg-accent dark:text-accent-foreground' },
  suspended: { label: 'Suspended', class: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30' },
  provisioning: { label: 'Provisioning', class: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30' },
  draft: { label: 'Draft', class: 'bg-muted text-muted-foreground' },
  signed: { label: 'Signed', class: 'bg-brand-lime text-brand-forest border-brand-forest/20' },
  provisioned: { label: 'Provisioned', class: 'bg-brand-forest text-brand-lime border-brand-forest' },
}
</script>

<template>
  <Badge variant="outline" :class="STYLES[status]?.class ?? ''">
    {{ STYLES[status]?.label ?? status }}
  </Badge>
</template>
