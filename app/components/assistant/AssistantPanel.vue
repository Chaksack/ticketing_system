<script setup lang="ts">
import type { AssistantSection } from '~/types/assistant'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  sections?: AssistantSection[]
}

const { isAgent, isBd, isSm, isAdmin } = useAuth()

const open = ref(false)
const input = ref('')
const isSending = ref(false)
const messages = ref<ChatMessage[]>([])
const listRef = ref<HTMLElement>()

defineShortcuts({
  Meta_J: () => open.value = true,
})

const suggestions = computed(() => {
  const items: string[] = []
  if (isAgent.value || isAdmin.value)
    items.push('Open tickets', 'Any SLA breaches?', 'My tickets')
  if (isBd.value || isSm.value || isAdmin.value)
    items.push('Clients by stage', 'Contracts expiring soon')
  if (isAdmin.value)
    items.push('Staff headcount')
  items.push('Give me a report', 'How do I create an invoice?')
  return items
})

async function scrollToBottom() {
  await nextTick()
  if (listRef.value)
    listRef.value.scrollTop = listRef.value.scrollHeight
}

async function send(text?: string) {
  const message = (text ?? input.value).trim()
  if (!message || isSending.value)
    return

  messages.value.push({ role: 'user', text: message })
  input.value = ''
  isSending.value = true
  await scrollToBottom()

  try {
    // Send the whole conversation so far — this is a real back-and-forth chat now, not
    // independent single-shot questions, so the assistant needs the prior turns for context.
    const history = messages.value.map(m => ({ role: m.role, text: m.text }))
    const { text: reply, sections } = await $fetch<{ text: string, sections: AssistantSection[] }>('/api/assistant/query', {
      method: 'POST',
      body: { messages: history },
    })
    messages.value.push({ role: 'assistant', text: reply, sections })
  }
  catch (error: any) {
    messages.value.push({
      role: 'assistant',
      text: error?.data?.statusMessage ?? 'Something went wrong answering that. Please try again.',
    })
  }
  finally {
    isSending.value = false
    await scrollToBottom()
  }
}

watch(open, (isOpen) => {
  if (!isOpen)
    return
  scrollToBottom()
})
</script>

<template>
  <Button variant="ghost" size="icon" @click="open = !open">
    <Icon name="i-lucide-sparkles" class="size-5" />
    <span class="sr-only">Ask AI</span>
  </Button>

  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-[50vw] p-0 flex flex-col gap-0">
      <SheetHeader class="p-4 pb-3 border-b">
        <SheetTitle class="flex items-center gap-2">
          <Icon name="i-lucide-sparkles" class="size-4" />
          Ask AI
        </SheetTitle>
        <SheetDescription>
          Ask about your data or how to use any part of the app — data questions are answered from live records.
        </SheetDescription>
      </SheetHeader>

      <div ref="listRef" class="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        <div v-if="!messages.length" class="flex flex-col gap-3">
          <p class="text-sm text-muted-foreground">
            Try one of these:
          </p>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="suggestion in suggestions"
              :key="suggestion"
              variant="secondary"
              size="sm"
              class="text-xs"
              @click="send(suggestion)"
            >
              {{ suggestion }}
            </Button>
          </div>
        </div>

        <div v-for="(message, index) in messages" :key="index" class="flex" :class="message.role === 'user' ? 'justify-end' : 'justify-start'">
          <div
            class="max-w-[85%] rounded-lg px-3 py-2 text-sm"
            :class="message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'"
          >
            <p v-if="message.text">
              {{ message.text }}
            </p>

            <div v-for="(section, sectionIndex) in message.sections" :key="sectionIndex" class="mt-2 first:mt-0 flex flex-col gap-2">
              <p v-if="section.heading" class="text-xs font-medium text-muted-foreground">
                {{ section.heading }}
              </p>

              <div v-if="section.stats?.length" class="flex flex-wrap gap-1.5">
                <Badge v-for="stat in section.stats" :key="stat.label" variant="outline" class="bg-background">
                  {{ stat.label }}: {{ stat.value }}
                </Badge>
              </div>

              <div v-if="section.table" class="overflow-x-auto rounded-md border bg-background">
                <table class="w-full text-xs">
                  <thead>
                    <tr class="border-b">
                      <th v-for="header in section.table.headers" :key="header" class="px-2 py-1.5 text-left font-medium text-muted-foreground">
                        {{ header }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in section.table.rows" :key="rowIndex" class="border-b last:border-0">
                      <td v-for="(cell, cellIndex) in row" :key="cellIndex" class="px-2 py-1.5">
                        {{ cell }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div v-if="isSending" class="flex justify-start">
          <div class="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Thinking...
          </div>
        </div>
      </div>

      <form class="border-t p-3 flex gap-2" @submit.prevent="send()">
        <Input v-model="input" aria-label="Ask a question" placeholder="Ask a question..." :disabled="isSending" class="flex-1" />
        <Button type="submit" size="icon" :disabled="isSending || !input.trim()">
          <Icon name="i-lucide-send" />
        </Button>
      </form>
    </SheetContent>
  </Sheet>
</template>
