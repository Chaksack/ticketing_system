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

  async function fetchTicket(id: string) {
    const { ticket } = await $fetch(`/api/tickets/${id}`)
    const index = tickets.value.findIndex(t => t.id === id)
    if (index === -1)
      tickets.value.unshift(ticket)
    else
      tickets.value[index] = ticket
    return ticket
  }

  async function addTicket(payload: NewTicket) {
    const { ticket } = await $fetch('/api/tickets', { method: 'POST', body: payload })
    tickets.value.unshift(ticket)
    return ticket
  }

  async function addReply(ticketId: string, message: string) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}/replies`, { method: 'POST', body: { message } })
    const index = tickets.value.findIndex(t => t.id === ticketId)
    if (index !== -1)
      tickets.value[index] = ticket
    return ticket
  }

  async function updateStatus(ticketId: string, status: TicketStatus) {
    const { ticket } = await $fetch(`/api/tickets/${ticketId}`, { method: 'PATCH', body: { status } })
    const index = tickets.value.findIndex(t => t.id === ticketId)
    if (index !== -1)
      tickets.value[index] = ticket
    return ticket
  }

  async function removeTicket(ticketId: string) {
    await $fetch(`/api/tickets/${ticketId}`, { method: 'DELETE' })
    tickets.value = tickets.value.filter(t => t.id !== ticketId)
  }

  return { tickets, fetchTickets, getTicket, fetchTicket, addTicket, addReply, updateStatus, removeTicket }
}
