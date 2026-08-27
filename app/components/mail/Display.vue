<script lang="ts" setup>
import type { GmailMessage } from '~/types/gmail'
import { format } from 'date-fns'
import { Archive, ArchiveX, ArrowLeft, Clock, Forward, MoreVertical, Reply, ReplyAll, Trash2 } from 'lucide-vue-next'
import { computed, ref, watch } from 'vue'
import { toast } from 'vue-sonner'

interface MailDisplayProps {
  mail: GmailMessage | undefined
}

const props = defineProps<MailDisplayProps>()

const emit = defineEmits(['close'])

const { status, sendReply, archiveMessage, markAsSpam, trashMessage, markAsUnread, toggleStar } = useGmailAccount()

const mailFallbackName = computed(() => {
  return props.mail?.name
    .split(' ')
    .map(chunk => chunk[0])
    .join('')
})

type ComposeMode = 'reply' | 'replyAll' | 'forward'
const composeMode = ref<ComposeMode>('reply')
const replyText = ref('')
const forwardTo = ref('')
const isSending = ref(false)
const isBusy = ref(false)

watch(() => props.mail?.id, () => {
  replyText.value = ''
  forwardTo.value = ''
  composeMode.value = 'reply'
})

function startCompose(mode: ComposeMode) {
  composeMode.value = mode
  if (mode === 'forward' && props.mail) {
    forwardTo.value = ''
    replyText.value = `\n\n---------- Forwarded message ----------\nFrom: ${props.mail.name} <${props.mail.email}>\nSubject: ${props.mail.subject}\nDate: ${format(new Date(props.mail.date), 'PPpp')}\n\n${props.mail.text}`
  }
  else {
    replyText.value = ''
  }
}

function parseRecipientEmails(value: string | undefined): string[] {
  if (!value)
    return []
  return value.split(',').map((part) => {
    const match = part.match(/<([^>]+)>/)
    return (match?.[1] ?? part).trim()
  }).filter(Boolean)
}

const isStarred = computed(() => props.mail?.labels.includes('starred') ?? false)

async function onSendReply() {
  if (!props.mail || !replyText.value.trim())
    return

  if (composeMode.value === 'forward' && !forwardTo.value.trim()) {
    toast.error('Enter a recipient to forward to')
    return
  }

  let to: string
  if (composeMode.value === 'forward') {
    to = forwardTo.value.trim()
  }
  else if (composeMode.value === 'replyAll') {
    const others = [...parseRecipientEmails(props.mail.to), ...parseRecipientEmails(props.mail.cc)]
      .filter(email => email.toLowerCase() !== status.value.email?.toLowerCase() && email.toLowerCase() !== props.mail!.email.toLowerCase())
    to = [props.mail.email, ...new Set(others)].join(', ')
  }
  else {
    to = props.mail.email
  }

  const isForward = composeMode.value === 'forward'
  const subjectPrefix = isForward ? 'Fwd:' : 'Re:'
  const subject = props.mail.subject.startsWith(subjectPrefix) ? props.mail.subject : `${subjectPrefix} ${props.mail.subject}`

  isSending.value = true
  try {
    await sendReply({
      to,
      subject,
      text: replyText.value.trim(),
      threadId: isForward ? undefined : props.mail.threadId,
      inReplyToMessageId: isForward ? undefined : props.mail.messageIdHeader,
    })
    replyText.value = ''
    forwardTo.value = ''
    composeMode.value = 'reply'
    toast(isForward ? 'Message forwarded' : 'Reply sent')
  }
  catch (error: any) {
    toast.error('Could not send', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isSending.value = false
  }
}

async function withBusy(action: () => Promise<void>) {
  isBusy.value = true
  try {
    await action()
  }
  catch (error: any) {
    toast.error('Could not complete that action', {
      description: error?.data?.statusMessage ?? 'Something went wrong. Please try again.',
    })
  }
  finally {
    isBusy.value = false
  }
}

async function onArchive() {
  if (!props.mail)
    return
  const id = props.mail.id
  await withBusy(async () => {
    await archiveMessage(id)
    toast('Message archived')
    emit('close')
  })
}

async function onMarkSpam() {
  if (!props.mail)
    return
  const id = props.mail.id
  await withBusy(async () => {
    await markAsSpam(id)
    toast('Moved to junk')
    emit('close')
  })
}

async function onTrash() {
  if (!props.mail)
    return
  const id = props.mail.id
  await withBusy(async () => {
    await trashMessage(id)
    toast('Moved to trash')
    emit('close')
  })
}

async function onMarkUnread() {
  if (!props.mail)
    return
  const id = props.mail.id
  await withBusy(async () => {
    await markAsUnread(id)
    toast('Marked as unread')
    emit('close')
  })
}

async function onToggleStar() {
  if (!props.mail)
    return
  const id = props.mail.id
  const wasStarred = isStarred.value
  await withBusy(async () => {
    await toggleStar(id, wasStarred)
    toast(wasStarred ? 'Star removed' : 'Thread starred')
  })
}

function onNotSupported(feature: string) {
  toast.error(`${feature} isn't available`, {
    description: 'Gmail\'s API doesn\'t expose this action to connected apps.',
  })
}
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex items-center p-2">
      <div class="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail" @click="emit('close')">
              <ArrowLeft class="size-4" />
              <span class="sr-only">Back</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail || isBusy" @click="onArchive">
              <Archive class="size-4" />
              <span class="sr-only">Archive</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Archive</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail || isBusy" @click="onMarkSpam">
              <ArchiveX class="size-4" />
              <span class="sr-only">Move to junk</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Move to junk</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail || isBusy" @click="onTrash">
              <Trash2 class="size-4" />
              <span class="sr-only">Move to trash</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Move to trash</TooltipContent>
        </Tooltip>
        <Separator orientation="vertical" class="mx-1 !h-6" />
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail" @click="onNotSupported('Snooze')">
              <Clock class="size-4" />
              <span class="sr-only">Snooze</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Snooze (not supported by Gmail's API)</TooltipContent>
        </Tooltip>
      </div>
      <div class="ml-auto flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail" @click="startCompose('reply')">
              <Reply class="size-4" />
              <span class="sr-only">Reply</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reply</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail" @click="startCompose('replyAll')">
              <ReplyAll class="size-4" />
              <span class="sr-only">Reply all</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Reply all</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button variant="ghost" size="icon" :disabled="!mail" @click="startCompose('forward')">
              <Forward class="size-4" />
              <span class="sr-only">Forward</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Forward</TooltipContent>
        </Tooltip>
      </div>
      <Separator orientation="vertical" class="mx-2 !h-6" />
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon" :disabled="!mail || isBusy">
            <MoreVertical class="size-4" />
            <span class="sr-only">More</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem @click="onMarkUnread">
            Mark as unread
          </DropdownMenuItem>
          <DropdownMenuItem @click="onToggleStar">
            {{ isStarred ? 'Unstar thread' : 'Star thread' }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="onNotSupported('Custom labels')">
            Add label
          </DropdownMenuItem>
          <DropdownMenuItem @click="onNotSupported('Mute thread')">
            Mute thread
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
    <Separator />
    <div v-if="mail" class="flex flex-1 flex-col">
      <div class="flex items-start p-4">
        <div class="flex items-start gap-4 text-sm">
          <Avatar>
            <AvatarFallback>
              {{ mailFallbackName }}
            </AvatarFallback>
          </Avatar>
          <div class="grid gap-1">
            <div class="font-semibold">
              {{ mail.name }}
            </div>
            <div class="line-clamp-1 text-xs">
              {{ mail.subject }}
            </div>
            <div class="line-clamp-1 text-xs">
              <span class="font-medium">Reply-To:</span> {{ mail.email }}
            </div>
          </div>
        </div>
        <div v-if="mail.date" class="ml-auto text-xs text-muted-foreground">
          {{ format(new Date(mail.date), "PPpp") }}
        </div>
      </div>
      <Separator />
      <div class="flex-1 whitespace-pre-wrap p-4 text-sm">
        {{ mail.text }}
      </div>
      <Separator class="mt-auto" />
      <div class="p-4">
        <form @submit.prevent="onSendReply">
          <div class="grid gap-2">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <span v-if="composeMode === 'reply'">Replying to {{ mail.email }}</span>
              <span v-else-if="composeMode === 'replyAll'">Replying to all recipients</span>
              <span v-else>Forwarding</span>
            </div>
            <Input v-if="composeMode === 'forward'" v-model="forwardTo" type="email" placeholder="Forward to email address" class="mb-1" />
            <Textarea
              v-model="replyText"
              class="p-4"
              :placeholder="`Reply ${mail.name}...`"
            />
            <div class="flex items-center">
              <Label
                html-for="mute"
                class="flex items-center gap-2 text-xs font-normal text-muted-foreground"
              >
                <Switch id="mute" disabled aria-label="Mute thread (not supported)" /> Mute this thread
              </Label>
              <Button
                type="submit"
                size="sm"
                class="ml-auto"
                :disabled="!replyText.trim() || isSending"
              >
                {{ isSending ? 'Sending…' : 'Send' }}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
    <div v-else class="p-8 text-center text-muted-foreground">
      No message selected
    </div>
  </div>
</template>
