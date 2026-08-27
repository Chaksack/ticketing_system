import type { ChatChannel, ChatMessage } from '~/types/chat'

export function useChat() {
  const channels = useState<ChatChannel[]>('chat-channels', () => [])
  const messagesByChannel = useState<Record<string, ChatMessage[]>>('chat-messages', () => ({}))
  const unreadCount = useState('chat-unread-count', () => 0)

  function upsertChannel(channel: ChatChannel) {
    const index = channels.value.findIndex(c => c.id === channel.id)
    if (index === -1)
      channels.value.unshift(channel)
    else
      channels.value[index] = channel
  }

  async function fetchChannels() {
    const { channels: rows } = await $fetch<{ channels: ChatChannel[] }>('/api/chat/channels')
    channels.value = rows
  }

  async function fetchUnreadCount() {
    const { unreadCount: count } = await $fetch<{ unreadCount: number }>('/api/chat/unread-count')
    unreadCount.value = count
  }

  async function openDirectChannel(staffId: string) {
    const { channel } = await $fetch<{ channel: ChatChannel }>('/api/chat/channels', { method: 'POST', body: { type: 'direct', staffId } })
    upsertChannel(channel)
    return channel
  }

  async function createGroupChannel(name: string, memberIds: string[]) {
    const { channel } = await $fetch<{ channel: ChatChannel }>('/api/chat/channels', { method: 'POST', body: { type: 'group', name, memberIds } })
    upsertChannel(channel)
    return channel
  }

  async function updateChannel(channelId: string, patch: { name?: string, memberIds?: string[] }) {
    const { channel } = await $fetch<{ channel: ChatChannel }>(`/api/chat/channels/${channelId}`, { method: 'PATCH', body: patch })
    upsertChannel(channel)
    return channel
  }

  async function fetchMessages(channelId: string) {
    const { messages } = await $fetch<{ messages: ChatMessage[] }>(`/api/chat/channels/${channelId}/messages`)
    messagesByChannel.value = { ...messagesByChannel.value, [channelId]: messages }
  }

  async function sendMessage(channelId: string, body: string) {
    const { message } = await $fetch<{ message: ChatMessage }>(`/api/chat/channels/${channelId}/messages`, { method: 'POST', body: { body } })
    messagesByChannel.value = { ...messagesByChannel.value, [channelId]: [...(messagesByChannel.value[channelId] ?? []), message] }
    return message
  }

  async function markRead(channelId: string) {
    await $fetch(`/api/chat/channels/${channelId}/read`, { method: 'POST' })
    const channel = channels.value.find(c => c.id === channelId)
    if (channel)
      channel.unreadCount = 0
  }

  return {
    channels,
    messagesByChannel,
    unreadCount,
    fetchChannels,
    fetchUnreadCount,
    openDirectChannel,
    createGroupChannel,
    updateChannel,
    fetchMessages,
    sendMessage,
    markRead,
  }
}
