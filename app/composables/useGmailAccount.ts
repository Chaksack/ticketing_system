import type { GmailMessage, GmailStatus } from '~/types/gmail'

export function useGmailAccount() {
  const status = useState<GmailStatus>('gmail-status', () => ({ connected: false }))
  const messages = useState<GmailMessage[]>('gmail-messages', () => [])
  const isLoadingMessages = useState('gmail-messages-loading', () => false)

  async function fetchStatus() {
    status.value = await $fetch<GmailStatus>('/api/integrations/gmail/status')
  }

  function connect() {
    window.location.href = '/api/integrations/gmail/connect'
  }

  async function disconnect() {
    await $fetch('/api/integrations/gmail', { method: 'DELETE' })
    status.value = { connected: false }
    messages.value = []
  }

  async function fetchMessages(query?: string) {
    isLoadingMessages.value = true
    try {
      const { messages: rows } = await $fetch<{ messages: GmailMessage[] }>('/api/integrations/gmail/messages', {
        query: query ? { q: query } : {},
      })
      messages.value = rows
    }
    finally {
      isLoadingMessages.value = false
    }
  }

  async function fetchMessageBody(id: string) {
    const detail = await $fetch<{ text: string, messageIdHeader?: string, from?: string, to?: string, cc?: string }>(`/api/integrations/gmail/messages/${id}`)
    const message = messages.value.find(m => m.id === id)
    if (message) {
      message.text = detail.text
      message.to = detail.to
      message.cc = detail.cc
      message.messageIdHeader = detail.messageIdHeader
    }
    return detail
  }

  async function sendReply(payload: { to: string, subject: string, text: string, threadId?: string, inReplyToMessageId?: string }) {
    await $fetch('/api/integrations/gmail/send', { method: 'POST', body: payload })
  }

  function removeFromList(id: string) {
    messages.value = messages.value.filter(m => m.id !== id)
  }

  async function archiveMessage(id: string) {
    await $fetch(`/api/integrations/gmail/messages/${id}/modify`, { method: 'POST', body: { removeLabelIds: ['INBOX'] } })
    removeFromList(id)
  }

  async function markAsSpam(id: string) {
    await $fetch(`/api/integrations/gmail/messages/${id}/modify`, { method: 'POST', body: { addLabelIds: ['SPAM'], removeLabelIds: ['INBOX'] } })
    removeFromList(id)
  }

  async function trashMessage(id: string) {
    await $fetch(`/api/integrations/gmail/messages/${id}/trash`, { method: 'POST' })
    removeFromList(id)
  }

  async function markAsUnread(id: string) {
    await $fetch(`/api/integrations/gmail/messages/${id}/modify`, { method: 'POST', body: { addLabelIds: ['UNREAD'] } })
    const message = messages.value.find(m => m.id === id)
    if (message)
      message.read = false
  }

  async function toggleStar(id: string, starred: boolean) {
    await $fetch(`/api/integrations/gmail/messages/${id}/modify`, {
      method: 'POST',
      body: starred ? { removeLabelIds: ['STARRED'] } : { addLabelIds: ['STARRED'] },
    })
    const message = messages.value.find(m => m.id === id)
    if (message) {
      message.labels = starred
        ? message.labels.filter(l => l !== 'starred')
        : [...message.labels, 'starred']
    }
  }

  return {
    status,
    messages,
    isLoadingMessages,
    fetchStatus,
    connect,
    disconnect,
    fetchMessages,
    fetchMessageBody,
    sendReply,
    archiveMessage,
    markAsSpam,
    trashMessage,
    markAsUnread,
    toggleStar,
  }
}
