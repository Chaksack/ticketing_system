/**
 * A deliberately small Markdown renderer for knowledge articles and marketing emails. Everything
 * is HTML-escaped first, then only a fixed set of constructs is turned back into tags, so the
 * output is safe to v-html / email even though staff (and AI drafts) wrote the source:
 *
 *   # / ## / ### headings · **bold** · *italic* · [link](https://…) · ![alt](https://…)
 *   1. numbered steps · - bullets · @[video](YouTube URL) · blank line = new paragraph
 */

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

/** Only absolute http(s) URLs survive; anything else (javascript:, data:, relative) is dropped. */
function safeUrl(raw: string) {
  try {
    const url = new URL(raw.replace(/&amp;/g, '&'))
    return url.protocol === 'https:' || url.protocol === 'http:' ? escapeHtml(url.toString()) : null
  }
  catch {
    return null
  }
}

function youtubeId(raw: string) {
  const match = raw.replace(/&amp;/g, '&').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/)
  return match?.[1] ?? null
}

function inline(text: string) {
  return text
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_, alt: string, url: string) => {
      const src = safeUrl(url)
      return src ? `<img src="${src}" alt="${alt}" loading="lazy" style="max-width:100%;border-radius:12px">` : alt
    })
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => {
      const href = safeUrl(url)
      return href ? `<a href="${href}" target="_blank" rel="noopener noreferrer">${label}</a>` : label
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
}

export function renderMarkdown(source: string, options: { embeds?: boolean } = {}): string {
  const blocks = escapeHtml(source.replace(/\r\n/g, '\n')).split(/\n{2,}/)
  return blocks.map((block) => {
    const lines = block.split('\n').filter(line => line.trim())
    if (!lines.length)
      return ''

    const heading = lines.length === 1 ? lines[0]!.match(/^(#{1,3}) (\S.*)$/) : null
    if (heading) {
      const level = heading[1]!.length + 1
      return `<h${level}>${inline(heading[2]!)}</h${level}>`
    }

    const video = lines.length === 1 ? lines[0]!.trim().match(/^@\[video\]\(([^)\s]+)\)$/) : null
    if (video) {
      const id = youtubeId(video[1]!)
      if (id && options.embeds !== false)
        return `<div style="position:relative;padding-top:56.25%"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="Video" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:12px" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>`
      const href = safeUrl(video[1]!)
      return href ? `<p><a href="${href}" target="_blank" rel="noopener noreferrer">Watch the video</a></p>` : ''
    }

    if (lines.every(line => /^\d+[.)]\s+/.test(line)))
      return `<ol>${lines.map(line => `<li>${inline(line.replace(/^\d+[.)]\s+/, ''))}</li>`).join('')}</ol>`
    if (lines.every(line => /^[-*]\s+/.test(line)))
      return `<ul>${lines.map(line => `<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`).join('')}</ul>`

    return `<p>${lines.map(inline).join('<br>')}</p>`
  }).join('\n')
}

/** Plain text for search snippets, previews and the text part of emails. */
export function markdownToText(source: string): string {
  return source
    .replace(/@\[video\]\(([^)]+)\)/g, 'Video: $1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim()
}
