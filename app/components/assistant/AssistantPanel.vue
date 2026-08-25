<script setup lang="ts">
import type { AssistantSection } from '~/types/assistant'

interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  sections?: AssistantSection[]
}

const { isAgent, isBd, isSm, isAdmin } = useAuth()
const { metaSymbol } = useShortcuts()

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
  items.push('Give me a report')
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
    const { sections } = await $fetch<{ sections: AssistantSection[] }>('/api/assistant/query', {
      method: 'POST',
      body: { message },
    })
    let intro = ''
    if (sections[0]?.heading)
      intro = `Here's what I found:`
    else if (!sections.length)
      intro = 'I couldn\'t find anything for that.'
    messages.value.push({ role: 'assistant', text: intro, sections })
  }
  catch {
    messages.value.push({ role: 'assistant', text: 'Something went wrong answering that. Please try again.' })
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
  <SidebarMenuButton as-child tooltip="Ask AI">
    <Button variant="outline" size="sm" class="text-xs" @click="open = !open">
      <Icon name="i-lucide-sparkles" />
      <span class="font-normal group-data-[collapsible=icon]:hidden">Ask AI</span>
      <div class="ml-auto flex items-center space-x-0.5 group-data-[collapsible=icon]:hidden">
        <Kbd>{{ metaSymbol }}</Kbd>
        <Kbd>J</Kbd>
      </div>
    </Button>
  </SidebarMenuButton>

  <Sheet v-model:open="open">
    <SheetContent side="right" class="w-full sm:max-w-[50vw] p-0 flex flex-col gap-0">
      <SheetHeader class="p-4 pb-3 border-b">
        <SheetTitle class="flex items-center gap-2">
          <Icon name="i-lucide-sparkles" class="size-4" />
          Ask AI
        </SheetTitle>
        <SheetDescription>
          Ask about tickets, clients, and AMC contracts — answers are generated from live data.
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
