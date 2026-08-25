<script setup lang="ts">
const { onCallStaff, fetchStaff } = useStaff()
const { pages, fetchPages, acknowledgePage } = useOnCall()

onMounted(() => {
  fetchStaff()
  fetchPages()
})

const recentPages = computed(() => pages.value.slice(0, 5))

function formatDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="grid gap-4 md:grid-cols-2">
    <Card>
      <CardHeader>
        <CardTitle>On-Call Now</CardTitle>
        <CardDescription>
          Staff who will be paged when a ticket is reported.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="!onCallStaff.length" class="text-sm text-muted-foreground">
          Nobody is on-call. Open a staff member to add them to the rotation.
        </p>
        <ul v-else class="flex flex-col gap-3">
          <li v-for="member in onCallStaff" :key="member.id" class="flex items-center gap-3">
            <Avatar class="h-8 w-8">
              <AvatarFallback>
                {{ member.name.split(' ').map((n) => n[0]).join('') }}
              </AvatarFallback>
            </Avatar>
            <div class="flex flex-col">
              <span class="text-sm font-medium">{{ member.name }}</span>
              <span class="text-xs text-muted-foreground">{{ member.email }}</span>
            </div>
            <Badge variant="secondary" class="ml-auto gap-1">
              <Icon name="i-lucide-radio" class="h-3 w-3" />
              On-call
            </Badge>
          </li>
        </ul>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Recent Pages</CardTitle>
        <CardDescription>
          The last few times on-call staff were paged for a reported ticket.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p v-if="!recentPages.length" class="text-sm text-muted-foreground">
          No pages sent yet.
        </p>
        <ul v-else class="flex flex-col gap-3">
          <li v-for="page in recentPages" :key="page.id" class="flex items-center justify-between gap-3 rounded-md border p-3">
            <div class="flex flex-col gap-0.5">
              <span class="text-sm font-medium">{{ page.staffName }}</span>
              <span class="text-xs text-muted-foreground">
                {{ page.ticketId }} · {{ page.ticketSubject }}
              </span>
              <span class="text-xs text-muted-foreground">{{ formatDate(page.createdAt) }}</span>
            </div>
            <Badge v-if="page.acknowledged" variant="secondary">
              Acknowledged
            </Badge>
            <Button v-else size="sm" variant="outline" @click="acknowledgePage(page.id)">
              Acknowledge
            </Button>
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
