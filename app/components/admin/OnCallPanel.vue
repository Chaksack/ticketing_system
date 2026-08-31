<script setup lang="ts">
const { onCallStaff, fetchStaff } = useStaff()

onMounted(() => {
  fetchStaff()
})
</script>

<template>
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
          <Badge variant="outline" class="ml-auto gap-1 bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30">
            <Icon name="i-lucide-radio" class="h-3 w-3" />
            On-call
          </Badge>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>
