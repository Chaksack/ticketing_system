import type { ChatChannel } from '~/types/chat'

export function channelOtherMember(channel: ChatChannel, currentUserId?: string) {
  return channel.type === 'direct' ? channel.members.find(m => m.id !== currentUserId) : undefined
}

export function channelDisplayName(channel: ChatChannel, currentUserId?: string): string {
  if (channel.type === 'group')
    return channel.name ?? 'Group chat'
  if (channel.type === 'project')
    return channel.name ?? channel.projectName ?? 'Channel'
  return channelOtherMember(channel, currentUserId)?.name ?? 'Direct message'
}

/** A lucide icon name standing in for an avatar on channel types that aren't a single person. */
export function channelIcon(channel: ChatChannel): string | undefined {
  if (channel.type === 'project')
    return 'i-lucide-hash'
  if (channel.type === 'group')
    return 'i-lucide-users'
  return undefined
}
