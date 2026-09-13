import type { AssistantSection } from '../../app/types/assistant'
import type { SessionUser } from './auth'
import Anthropic from '@anthropic-ai/sdk'
import {
  canSeeClients,
  canSeeTickets,
  clientsByStage,
  contractCounts,
  contractsExpiringSoon,
  isAdminUser,
  myClients,
  myTickets,
  onCallStaff,
  overview,
  runAssistantQuery,
  slaBreachSummary,
  staffHeadcount,
  ticketPriorityBreakdown,
  ticketStatusBreakdown,
  ticketVolume,
} from './assistant'

// Fast + cheap — this is a high-frequency internal utility, not the product's main surface, and
// every "tool" it can call is a trivial DB read, so a lighter model is plenty.
const MODEL = 'claude-haiku-4-5-20251001'
const MAX_TOOL_ITERATIONS = 4

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface AssistantChatResult {
  text: string
  sections: AssistantSection[]
}

interface ToolDef {
  description: string
  allowed: (user: SessionUser) => boolean
  run: (user: SessionUser) => Promise<AssistantSection[]>
}

// One tool per existing report the deterministic assistant already knew how to run — the model
// decides which (if any) fit a question; the actual data access and role gating are unchanged.
const TOOLS: Record<string, ToolDef> = {
  get_ticket_status_breakdown: { description: 'Count of tickets grouped by status (open/in-progress/resolved/closed), across the whole team.', allowed: canSeeTickets, run: () => ticketStatusBreakdown() },
  get_ticket_priority_breakdown: { description: 'Count of tickets grouped by priority (low/medium/high/urgent).', allowed: canSeeTickets, run: () => ticketPriorityBreakdown() },
  get_sla_breach_summary: { description: 'How many tickets are currently overdue on their SLA, and how many were resolved late.', allowed: canSeeTickets, run: () => slaBreachSummary() },
  get_my_tickets: { description: 'The current staff member\'s own assigned tickets, grouped by status.', allowed: canSeeTickets, run: user => myTickets(user) },
  get_ticket_volume: { description: 'How many tickets were created today and in the last 7 days.', allowed: canSeeTickets, run: () => ticketVolume() },
  get_oncall_staff: { description: 'Which staff members are currently marked on-call.', allowed: canSeeTickets, run: () => onCallStaff() },
  get_clients_by_stage: { description: 'Count of clients grouped by pipeline stage (lead/contacted/proposal/negotiation/active/lost).', allowed: canSeeClients, run: () => clientsByStage() },
  get_my_clients: { description: 'The current staff member\'s own assigned clients, grouped by stage.', allowed: canSeeClients, run: user => myClients(user) },
  get_contracts_expiring_soon: { description: 'AMC contracts expiring in the next 30 days, with client, plan, and expiry date.', allowed: canSeeClients, run: () => contractsExpiringSoon() },
  get_contract_counts: { description: 'Count of AMC contracts grouped by display status (submitted/negotiating/active/expiring/lost/expired/cancelled).', allowed: canSeeClients, run: () => contractCounts() },
  get_staff_headcount: { description: 'Count of staff grouped by role.', allowed: isAdminUser, run: () => staffHeadcount() },
  get_overview: { description: 'A general cross-area snapshot (tickets, clients, staff) scoped to whatever the current user\'s role can see. Use this for vague requests like "give me a report" or "how are things looking".', allowed: () => true, run: user => overview(user) },
}

const SYSTEM_PROMPT = `You are the in-app assistant for IBS's internal CRM/ticketing/finance platform, used by a support team, a BD/sales team, and a finance team.

Modules staff use day to day:
- Tickets: customer support requests with SLA targets, auto-assignment, escalation (Engineer -> Engineering Coordinator -> Engineering Lead), macros, tags, automation rules.
- Leads & Tenders: two staged sales pipelines with win-probability, converting into Clients when marked Won.
- Quotes: line-item proposals attached to a Lead/Tender, built from a shared Products catalog.
- Projects, Tasks & Sprints: a kanban board; Tasks can link to a Project and show who they're assigned to.
- Finance: Invoices/Receipts (balance and status recalculate automatically) and a real double-entry General Ledger (Chart of Accounts, Journal Entries, Fiscal Periods).
- Calendar: typed activities (meetings, site visits, etc.), a click-a-day agenda view, PDF export.
- Chat: direct messages, private groups, and self-service Project channels, with @mentions and reactions.
- Settings > Integrations: each staff member can connect their own Slack and Gmail accounts.

You have tools that fetch REAL, live data from the database, already scoped to what the current user's role is allowed to see. Always call a tool for questions about actual data (counts, statuses, who's on call, etc.) instead of guessing or inventing numbers. If no tool fits a data question, say so plainly.
For general "how do I..." or "what is..." questions about how the app works, answer directly using the module descriptions above rather than calling a tool.
If a tool reports the user doesn't have access, explain that plainly and don't try a different tool to work around it.
Keep answers short and direct — a sentence or two is usually enough. This is a busy internal tool, not a conversation to pad out.`

function buildFallbackText(sections: AssistantSection[]): string {
  if (!sections.length)
    return 'I couldn\'t find anything for that.'
  return sections[0]?.heading ? 'Here\'s what I found:' : ''
}

export async function runAiAssistantChat(user: SessionUser, history: ChatTurn[]): Promise<AssistantChatResult> {
  const config = useRuntimeConfig()

  // Graceful degradation: if no API key is configured, fall back to the original deterministic
  // keyword matcher rather than failing outright.
  if (!config.anthropicApiKey) {
    const lastUserMessage = [...history].reverse().find(turn => turn.role === 'user')?.text ?? ''
    const sections = await runAssistantQuery(user, lastUserMessage)
    return { text: buildFallbackText(sections), sections }
  }

  const client = new Anthropic({ apiKey: config.anthropicApiKey })

  const anthropicTools: Anthropic.Tool[] = Object.entries(TOOLS).map(([name, tool]) => ({
    name,
    description: tool.description,
    input_schema: { type: 'object', properties: {} },
  }))

  const messages: Anthropic.MessageParam[] = history.map(turn => ({ role: turn.role, content: turn.text }))
  const collectedSections: AssistantSection[] = []

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages,
    })

    const toolUseBlocks = response.content.filter(block => block.type === 'tool_use')

    if (!toolUseBlocks.length) {
      const text = response.content
        .filter(block => block.type === 'text')
        .map(block => block.text)
        .join('\n')
        .trim()
      return { text: text || 'I\'m not sure how to answer that.', sections: collectedSections }
    }

    messages.push({ role: 'assistant', content: response.content })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of toolUseBlocks) {
      const tool = TOOLS[block.name]
      let sections: AssistantSection[]

      if (!tool)
        sections = [{ stats: [{ label: 'Error', value: 'Unknown tool' }] }]
      else if (!tool.allowed(user))
        sections = [{ stats: [{ label: 'Access', value: 'You don\'t have access to that data.' }] }]
      else
        sections = await tool.run(user)

      if (tool?.allowed(user))
        collectedSections.push(...sections)

      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(sections) })
    }

    messages.push({ role: 'user', content: toolResults })
  }

  return { text: 'That took more steps than expected — try rephrasing your question.', sections: collectedSections }
}
