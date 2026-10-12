export type KbStatus = 'draft' | 'in_review' | 'published' | 'archived'
export type KbVisibility = 'public' | 'internal'

export const KB_STATUSES: { value: KbStatus, label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In review' },
  { value: 'published', label: 'Published' },
  { value: 'archived', label: 'Archived' },
]

export const KB_VISIBILITY: { value: KbVisibility, label: string }[] = [
  { value: 'public', label: 'Customers (portal) and staff' },
  { value: 'internal', label: 'Staff only' },
]

export interface KbArticle {
  id: string
  title: string
  /** Markdown — see app/lib/markdown.ts for what's supported. */
  body: string
  status: KbStatus
  visibility: KbVisibility
  products: string[]
  reviewerId?: string
  reviewerName?: string
  sourceTicketId?: string
  authorId?: string
  authorName?: string
  version: number
  views: number
  helpfulYes: number
  helpfulNo: number
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

/** What the customer portal sees of a published, public article. */
export interface PublicKbArticle {
  id: string
  title: string
  body: string
  updatedAt: string
}
