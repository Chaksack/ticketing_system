export interface MessageSegment {
  type: 'text' | 'reference'
  text: string
  refUrl?: string
}

const REFERENCE_REGEX = /\{\{([A-Z]+-\d+):([^{}]*)\}\}/g

const TYPE_PREFIX_TO_PATH: Record<string, string> = {
  TICKET: '/tickets',
  LEAD: '/leads',
  CLIENT: '/clients',
  TASK: '/tasks',
  PROJECT: '/projects',
}

export function parseMessageBody(body: string): MessageSegment[] {
  const segments: MessageSegment[] = []
  let lastIndex = 0

  for (const match of body.matchAll(REFERENCE_REGEX)) {
    const index = match.index ?? 0
    if (index > lastIndex)
      segments.push({ type: 'text', text: body.slice(lastIndex, index) })

    const [full, id, label] = match
    if (!id) {
      lastIndex = index + full.length
      continue
    }

    const prefix = id.split('-')[0] ?? ''
    const path = TYPE_PREFIX_TO_PATH[prefix]

    segments.push({
      type: 'reference',
      text: label || id,
      refUrl: path ? `${path}?open=${id}` : undefined,
    })

    lastIndex = index + full.length
  }

  if (lastIndex < body.length)
    segments.push({ type: 'text', text: body.slice(lastIndex) })

  return segments
}

export function insertReferenceToken(id: string, label: string) {
  const safeLabel = label.replace(/[{}]/g, '')
  return `{{${id}:${safeLabel}}}`
}
