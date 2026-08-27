export interface GmailMessage {
  id: string
  threadId: string
  name: string
  email: string
  subject: string
  text: string
  date: string
  read: boolean
  labels: string[]
  to?: string
  cc?: string
  messageIdHeader?: string
}

export interface GmailStatus {
  connected: boolean
  email?: string
  connectedAt?: string
}
