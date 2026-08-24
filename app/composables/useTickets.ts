import type { Ticket, TicketPriority, TicketStatus } from '~/types/ticket'

export interface NewTicket {
  subject: string
  description: string
  requester: string
  requesterEmail: string
  category: string
  priority: TicketPriority
  referenceNumber?: string
  attachments?: string[]
  assigneeId?: string
}

export interface TicketPatch {
  status?: TicketStatus
  priority?: TicketPriority
  category?: string
  assigneeId?: string | null
}

export function useTickets() {
  const tickets = useState<Ticket[]>('tickets-list', () => [])

  async function fetchTickets() {
    const { tickets: rows } = await $fetch('/api/tickets')
    tickets.value = rows
  }

  function getTicket(id: string) {
    return tickets.value.find(t => t.id === id)
  }

  function replaceTicket(ticket: Ticket) {
    const index = tickets.value.findIndex(t => t.id === ticket.id)
    if (index === -1)
      tickets.value.unshift(ticket)
    else
      tickets.value[index] = ticket
  }

  async function fetchTicket(id: string) {
    const { ticket } = await $fetch(`/api/tickets/${id}`)
    replaceTicket(ticket)
    return ticket
  }

  async function addTicket(payload: NewTicket) {
    const { ticket } = await $fetch('/api/tickets', { method: 'POST', body: payload })
    tickets.value.unshift(ticket)
    return ticket
  }

  async function addReply(ticketId: string, message: string, internal = false) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}/replies`, { method: 'POST', body: { message, internal } })
    replaceTicket(ticket)
    return ticket
  }

  async function updateStatus(ticketId: string, status: TicketStatus) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', body: { status } })
    replaceTicket(ticket)
    return ticket
  }

  async function updateTicket(ticketId: string, patch: TicketPatch) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', body: patch })
    replaceTicket(ticket)
    return ticket
  }

  async function addTag(ticketId: string, tag: { tagId?: string, name?: string }) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}/tags`, { method: 'POST', body: tag })
    replaceTicket(ticket)
    return ticket
  }

  async function removeTag(ticketId: string, tagId: string) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}/tags/${tagId}`, { method: 'DELETE' })
    replaceTicket(ticket)
    return ticket
  }

  async function applyMacro(ticketId: string, macroId: string) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}/apply-macro`, { method: 'POST', body: { macroId } })
    replaceTicket(ticket)
    return ticket
  }

  async function removeTicket(ticketId: string) {
    await $fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' })
    tickets.value = tickets.value.filter(t => t.id !== ticketId)
  }

  return { tickets, fetchTickets, getTicket, fetchTicket, addTicket, addReply, updateStatus, updateTicket, addTag, removeTag, applyMacro, removeTicket }
}
