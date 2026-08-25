const TICKET_ID_IN_MESSAGE_ID = /ticket-(TICKET-\d+)\./i
const TICKET_ID_IN_SUBJECT = /\[(TICKET-\d+)\]/i

/**
 * Every email this app sends carries a Message-ID shaped like
 * "<ticket-TICKET-1042.<random>@ibsgh.com>". When a customer replies, their mail client
 * echoes that id back in the In-Reply-To/References headers — search either (or both,
 * concatenated) for our encoded ticket id. This is the primary, most reliable way to route
 * a reply back to its ticket, since it doesn't depend on the customer's client preserving
 * subject text.
 */
export function extractTicketIdFromThreadHeaders(headerValue: string): string | undefined {
  const match = TICKET_ID_IN_MESSAGE_ID.exec(headerValue)
  return match?.[1]?.toUpperCase()
}

/**
 * Fallback for when thread headers don't carry our Message-ID (e.g. the customer started a
 * new email instead of replying) — looks for "[TICKET-1042]" in the subject, which every
 * outbound ticket email includes.
 */
export function extractTicketIdFromSubject(subject: string): string | undefined {
  const match = TICKET_ID_IN_SUBJECT.exec(subject)
  return match?.[1]?.toUpperCase()
}

const QUOTE_MARKERS = [
  /^On .+ wrote:\s*$/im, // Gmail, Apple Mail: "On Mon, Jan 1, 2026 at 1:00 PM, Jane <jane@example.com> wrote:"
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im, // Outlook
  /^From:\s.+$/im, // Outlook plaintext quoted header block
  /^Sent from my (iPhone|iPad|Android)/im,
]

/**
 * Trims the quoted "original message" most mail clients append below a reply, keeping only
 * what the customer actually typed. Heuristic, not exhaustive — falls back to the full text
 * if no known marker is found.
 */
export function stripQuotedReply(text: string): string {
  let cutIndex = text.length

  for (const marker of QUOTE_MARKERS) {
    const match = marker.exec(text)
    if (match && match.index < cutIndex)
      cutIndex = match.index
  }

  const withoutQuote = text.slice(0, cutIndex)

  const lines = withoutQuote.split('\n').filter(line => !line.trim().startsWith('>'))

  return lines.join('\n').trim()
}

export function htmlToPlainText(html: string): string {
  return html
    .replaceAll(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replaceAll(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replaceAll(/<br\s*\/?>/gi, '\n')
    .replaceAll(/<\/p>/gi, '\n\n')
    .replaceAll(/<[^>]+>/g, '')
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', '\'')
    .replaceAll(/\n{3,}/g, '\n\n')
    .trim()
}
