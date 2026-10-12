<script setup lang="ts">
import type { Segment } from '~/types/marketing'

definePageMeta({ middleware: 'bd' })

const segments = ref<(Segment & { memberCount: number })[]>([])
const loading = ref(true)
onMounted(async () => {
  try {
    segments.value = (await fetchUntyped<{ segments: (Segment & { memberCount: number })[] }>('/api/marketing/segments')).segments
  }
  finally {
    loading.value = false
  }
})
const date = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
</script>

<template>
  <div class="flex w-full flex-col gap-4">
    <MarketingNav />
    <PageActions label="Segment actions">
      <Button variant="lime" as-child>
        <NuxtLink to="/marketing/segments/new">
          <Icon name="i-lucide-plus" /> New segment
        </NuxtLink>
      </Button>
    </PageActions>
    <PageTitle title="Segments" description="Groups of leads, clients and client contacts, defined by rules. Members update as your records change." />

    <div class="rounded-[28px] bg-card px-3 pb-3 pt-1.5 ring-1 ring-black/10 sm:px-5 sm:pb-5 dark:ring-white/10">
      <Table class="[&_th]:h-11 [&_th]:text-[13px] [&_th]:font-semibold">
        <TableHeader>
          <TableRow>
            <TableHead>Segment</TableHead>
            <TableHead class="text-right">
              Members
            </TableHead>
            <TableHead>Rules</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="segment in segments" :key="segment.id" class="cursor-pointer" @click="navigateTo(`/marketing/segments/${segment.id}`)">
            <TableCell>
              <NuxtLink :to="`/marketing/segments/${segment.id}`" class="font-semibold text-foreground hover:underline" @click.stop>
                {{ segment.name }}
              </NuxtLink>
              <div v-if="segment.description" class="text-xs text-muted-foreground">
                {{ segment.description }}
              </div>
            </TableCell>
            <TableCell class="text-right font-semibold tabular-nums">
              {{ segment.memberCount }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ segment.conditions.length }} condition{{ segment.conditions.length === 1 ? '' : 's' }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ date(segment.updatedAt) }}
            </TableCell>
          </TableRow>
          <TableRow v-if="!segments.length">
            <TableCell :colspan="4" class="h-24 text-center text-muted-foreground">
              {{ loading ? 'Loading…' : 'No segments yet. Create one to send a journey to.' }}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
