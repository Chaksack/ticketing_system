import { markdownToText } from '../../../../app/lib/markdown'

const SYSTEM = `You help a customer-support agent reply in a live chat. Write the agent's next message only: short (1–3 sentences), warm, plain English, no greeting if the chat is already under way, no sign-off.
Use the knowledge-base articles if they are relevant. Never invent policies, prices or timelines that aren't in the conversation or the articles; if you don't know, suggest asking a clarifying question.`

/** "Suggest a reply" in the inbox, from the transcript plus matching knowledge articles. Needs a connected AI. */
export default defineEventHandler(async (event) => {
  const user = await requireServiceStaff(event)
  await ensureDb()

  const chat = await loadChatDetail(getRouterParam(event, 'id') ?? '')
  if (!chat)
    throw createError({ statusCode: 404, statusMessage: 'Chat not found' })

  const visitorText = chat.messages.filter(m => m.authorType === 'visitor').map(m => m.body).join(' ')
  const articles = await searchKbArticles(visitorText.slice(0, 800), { limit: 2 })
  const prompt = [
    articles.length ? `Knowledge-base articles:\n${articles.map(a => `# ${a.title}\n${markdownToText(a.body)}`).join('\n\n')}` : 'No matching knowledge-base articles.',
    `Conversation so far:\n${chat.messages.map(m => `${m.authorType === 'visitor' ? 'Customer' : m.authorType === 'agent' ? 'Agent' : 'System'}: ${m.body}`).join('\n')}`,
  ].join('\n\n').slice(0, 12000)

  const suggestion = await generateAiText(user, SYSTEM, prompt, 300)
  if (!suggestion)
    throw createError({ statusCode: 400, statusMessage: 'Connect an AI in Settings → Integrations to get suggested replies.' })
  return { suggestion }
})
