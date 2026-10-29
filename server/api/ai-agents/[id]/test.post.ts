import type { AiAgent } from '../../../../app/types/aiAgent'
import type { LiveChatMessage } from '../../../../app/types/liveChat'

/**
 * Playground: run the agent on a made-up conversation, with the settings on screen (saved or not).
 * Nothing is sent to anyone and tickets aren't created; the run is kept, marked as a test.
 */
export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)
  await ensureDb()
  const saved = await loadAiAgent(getRouterParam(event, 'id') ?? '')
  if (!saved)
    throw createError({ statusCode: 404, statusMessage: 'AI agent not found' })
  const body = await readBody<{ messages?: { from: 'customer' | 'ai', text: string }[], agent?: Partial<AiAgent> }>(event) ?? {}
  const messages = (body.messages ?? []).filter(m => m?.text?.trim()).slice(-30)
  if (!messages.length || messages.at(-1)!.from !== 'customer')
    throw createError({ statusCode: 400, statusMessage: 'Type a customer message to test' })

  const { name, ...config } = cleanAgentInput(body.agent ?? {}, saved)
  const agent: AiAgent = { ...saved, ...config, name: name || saved.name, enabled: true }
  const transcript: Pick<LiveChatMessage, 'authorType' | 'authorName' | 'body'>[] = messages.map(m => ({ authorType: m.from === 'customer' ? 'visitor' : 'ai', authorName: m.from === 'customer' ? user.name : agent.name, body: m.text.slice(0, 4000) }))

  const result = await runAgent({ agent, transcript, customer: { name: user.name, email: user.email, companyName: await workspaceName() }, dryRun: true })
  await recordRun(agent, undefined, messages.at(-1)!.text, result, true)
  return {
    result,
    // What a real chat would have shown after this turn.
    shown: [
      result.reply,
      result.handoffReason ? agent.handoffMessage : undefined,
    ].filter(Boolean),
  }
})
