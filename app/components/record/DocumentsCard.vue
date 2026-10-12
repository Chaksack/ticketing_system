<script setup lang="ts">
import { toast } from 'vue-sonner'

/** Files attached to a lead, tender or client. */
const props = defineProps<{
  documents: { id: string, name: string, url: string, size?: number }[]
  upload: (file: File) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
}>()

const input = ref<HTMLInputElement>()
const uploading = ref(false)

async function onChange(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file)
    return
  uploading.value = true
  try {
    await props.upload(file)
    toast('Document uploaded')
  }
  catch (error: any) {
    toast.error('Could not upload document', { description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.' })
  }
  finally {
    uploading.value = false
    if (input.value)
      input.value.value = ''
  }
}

function size(bytes?: number) {
  if (!bytes)
    return ''
  return bytes < 1024 ? `${bytes} B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1048576).toFixed(1)} MB`
}
</script>

<template>
  <RecordCard title="Files">
    <template #actions>
      <Button size="sm" variant="outline" :disabled="uploading" @click="input?.click()">
        <Icon name="i-lucide-upload" />
        {{ uploading ? 'Uploading…' : 'Upload' }}
      </Button>
    </template>
    <input ref="input" type="file" class="hidden" @change="onChange">
    <p v-if="!documents.length" class="m-0 text-sm text-muted-foreground">
      No files yet.
    </p>
    <div v-for="doc in documents" :key="doc.id" class="flex items-center gap-2 rounded-xl bg-muted/50 px-3 py-2 text-sm">
      <Icon name="i-lucide-paperclip" class="size-3.5 shrink-0 text-muted-foreground" />
      <a :href="doc.url" target="_blank" rel="noopener noreferrer" class="flex-1 truncate hover:underline">{{ doc.name }}</a>
      <span class="shrink-0 text-xs text-muted-foreground">{{ size(doc.size) }}</span>
      <Button size="icon-sm" variant="ghost" :aria-label="`Remove ${doc.name}`" @click="remove(doc.id)">
        <Icon name="i-lucide-x" class="size-3.5" />
      </Button>
    </div>
  </RecordCard>
</template>
