/**
 * AI agents answer customers in live chat first, grounded in the knowledge base, and hand the
 * conversation to a person when they can't help (or the customer asks). See server/utils/aiAgent.ts.
 */

/** ai_first: AI answers, a person takes over on handoff. ai_only: never hands off (offers a ticket instead). human_only: AI is off for new chats. */
export type AiServiceMode = 'ai_first' | 'ai_only' | 'human_only'
/** strict: answers must cite a knowledge article or tool result (the "answerability gate"); flexible: may answer general questions. */
export type AiAnswerMode = 'strict' | 'flexible'
export type AiResponseWindow = 'always' | 'business_hours' | 'outside_business_hours'
export type AiAgentTool = 'search_knowledge' | 'customer_tickets' | 'create_ticket' | 'handoff'

export interface AiScenario {
  id: string
  title: string
  /** When this applies, e.g. "The customer wants a refund". */
  trigger: string
  /** What to do, step by step. */
  instruction: string
  enabled: boolean
}

export interface AiAgent {
  id: string
  name: string
  description: string
  enabled: boolean
  serviceMode: AiServiceMode
  answerMode: AiAnswerMode
  /** Who the agent is and how it talks. */
  persona: string
  /** Extra rules (do / don't), always applied. */
  guardrails: string
  welcomeMessage: string
  /** Said when the knowledge base doesn't cover the question. */
  fallbackMessage: string
  /** Said when handing the chat to a person. */
  handoffMessage: string
  /** Said instead of the handoff message when no one on the team is online. */
  offlineMessage: string
  handoffOnRequest: boolean
  handoffOnNoAnswer: boolean
  /** Hand off straight away when a message contains one of these (e.g. "complaint", "cancel"). */
  handoffKeywords: string[]
  responseWindow: AiResponseWindow
  hours: { days: number[], start: string, end: string, timeZone: string }
  /** Close AI-only conversations after this many quiet minutes (0 = never). */
  autoResolveMinutes: number
  /** Share of new chats the agent takes (gradual rollout). */
  rolloutPercent: number
  /** Knowledge-base products the agent may use; empty = every published article. */
  knowledgeProducts: string[]
  tools: AiAgentTool[]
  scenarios: AiScenario[]
  maxSteps: number
  createdAt: string
  updatedAt: string
  updatedBy?: string
}

export type AiRunOutcome = 'answered' | 'clarified' | 'fallback' | 'handoff' | 'ticket' | 'error'

export interface AiRunStep {
  tool: string
  input: Record<string, unknown>
  /** Short description of what came back. */
  result: string
}

export interface AiAgentRun {
  id: string
  agentId: string
  agentName?: string
  chatId?: string
  question: string
  outcome: AiRunOutcome
  reply?: string
  sources: { id: string, title: string }[]
  steps: AiRunStep[]
  handoffReason?: string
  error?: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  dryRun: boolean
  createdAt: string
}

export interface AiAgentStats {
  conversations: number
  resolvedByAi: number
  handoffs: number
  fallbacks: number
}

export type AiModelProvider = 'company' | 'anthropic' | 'openai'

/** The workspace's AI connection for agents (keys are never sent back). */
export interface AiModelSettings {
  provider: AiModelProvider
  model: string
  baseUrl: string
  hasApiKey: boolean
  /** The company key (NUXT_ANTHROPIC_API_KEY) is set on the server. */
  companyKeyAvailable: boolean
  updatedAt?: string
}

export const AI_TOOL_OPTIONS: { value: AiAgentTool, label: string, description: string }[] = [
  { value: 'search_knowledge', label: 'Search the knowledge base', description: 'Look up published articles to answer from.' },
  { value: 'customer_tickets', label: 'Look up the customer\'s tickets', description: 'Tell customers the status of their open cases (matched by email).' },
  { value: 'create_ticket', label: 'Create a ticket', description: 'Open a case with the details when something needs follow-up.' },
  { value: 'handoff', label: 'Hand off to a person', description: 'Pass the chat to the team with a summary.' },
]

export const AI_OUTCOME_LABELS: Record<AiRunOutcome, string> = {
  answered: 'Answered',
  clarified: 'Asked to clarify',
  fallback: 'No answer in knowledge',
  handoff: 'Handed to a person',
  ticket: 'Created a ticket',
  error: 'AI unavailable',
}
