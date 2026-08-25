<script setup lang="ts">
import type { SlaPolicy } from '~/types/automation'
import { toast } from 'vue-sonner'

definePageMeta({
  middleware: 'admin',
})

const { policies, fetchPolicies, updatePolicy } = useSlaPolicies()

onMounted(() => {
  fetchPolicies()
})

const drafts = reactive<Record<string, { firstResponseMins: number, resolutionMins: number }>>({})

watch(policies, (list) => {
  for (const policy of list) {
    if (!drafts[policy.priority]) {
      drafts[policy.priority] = { firstResponseMins: policy.firstResponseMins, resolutionMins: policy.resolutionMins }
    }
  }
}, { immediate: true })

function formatMins(mins: number) {
  if (mins < 60)
    return `${mins}m`
  const hours = mins / 60
  return Number.isInteger(hours) ? `${hours}h` : `${hours.toFixed(1)}h`
}

async function save(policy: SlaPolicy) {
  const draft = drafts[policy.priority]
  if (!draft)
    return

  try {
    await updatePolicy(policy.priority, draft)
    toast('SLA policy updated', {
      description: `${policy.priority} targets saved.`,
    })
  }
  catch (error: any) {
    toast('Could not update policy', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
}
</script>

<template>
  <div class="w-full flex flex-col items-stretch gap-4">
    <div>
      <h2 class="text-2xl font-bold tracking-tight">
        SLA Policies
      </h2>
      <p class="text-muted-foreground">
        First-response and resolution targets by priority. Breaches automatically page on-call staff.
      </p>
    </div>

    <div class="border rounded-md">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Priority</TableHead>
            <TableHead>First response target</TableHead>
            <TableHead>Resolution target</TableHead>
            <TableHead class="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="policy in policies" :key="policy.id">
            <TableCell>
              <Badge variant="secondary" class="capitalize">
                {{ policy.priority }}
              </Badge>
            </TableCell>
            <TableCell>
              <div v-if="drafts[policy.priority]" class="flex items-center gap-2">
                <Input v-model.number="drafts[policy.priority]!.firstResponseMins" type="number" min="1" class="w-24 h-8" />
                <span class="text-xs text-muted-foreground">min ({{ formatMins(drafts[policy.priority]!.firstResponseMins) }})</span>
              </div>
            </TableCell>
            <TableCell>
              <div v-if="drafts[policy.priority]" class="flex items-center gap-2">
                <Input v-model.number="drafts[policy.priority]!.resolutionMins" type="number" min="1" class="w-24 h-8" />
                <span class="text-xs text-muted-foreground">min ({{ formatMins(drafts[policy.priority]!.resolutionMins) }})</span>
              </div>
            </TableCell>
            <TableCell>
              <Button size="sm" variant="outline" @click="save(policy)">
                Save
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  </div>
</template>
